import { describe, expect, it } from "vitest";
import { formatDate, parseDate } from "../src/dates";
import { evaluateRent } from "../src/evaluate";
import { type Cents, cents, formatEuro } from "../src/money";
import type { RentQuery } from "../src/types";
import { CPI } from "./fixtures";
import { rtbCalculate } from "./rtb-oracle";

/**
 * Sprint 2, the headline measurement.
 *
 * Our engine against an independent transcription of the RTB's own algorithm, over a large
 * generated case set. The oracle is deliberately separate and deliberately uses the RTB's
 * float arithmetic, so this measures real agreement rather than a function agreeing with
 * itself.
 *
 * The engine's headline figure follows the RTB by design (ADR-0006), so the expectation is
 * exact agreement. Any disagreement is a finding, not a tolerance to widen.
 */

const CPI_ROWS = CPI.series.map((r) => ({ month: r.month, value: r.value }));

/** Every case the sweep covers, so the reported N means something. */
interface Case {
  readonly previousSetting: string;
  readonly newSetting: string;
  readonly rentCents: number;
  readonly newBuild: boolean;
}

function* sweep(): Generator<Case> {
  // Anchors chosen to cross 1 March 2026, to sit either side of a CPI fall
  // (Dec 2025 104.2 to Jan 2026 103.3), and to reach past the end of the table so the
  // publication-lag fallback is exercised.
  const starts = [
    "2024-01-15",
    "2024-06-30",
    "2025-01-01",
    "2025-02-28",
    "2025-06-01",
    "2025-12-31",
    "2026-01-01",
    "2026-02-28",
    "2026-03-01",
    "2026-04-10",
  ];
  // Day counts that land on month boundaries, just before them, and just after, so the
  // `if (b.d < a.d) months -= 1` branch is hit from both sides.
  const offsets = [1, 27, 28, 29, 30, 31, 59, 89, 90, 180, 364, 365, 366, 400, 456, 730, 1096];
  const rents = [1, 50_000, 95_050, 100_000, 123_435, 175_055, 200_000, 999_999];

  for (const start of starts) {
    for (const offset of offsets) {
      for (const rentCents of rents) {
        for (const newBuild of [false, true]) {
          const previous = parseDate(start);
          const next = addDays(previous, offset);
          yield {
            previousSetting: start,
            newSetting: formatDate(next),
            rentCents,
            newBuild,
          };
        }
      }
    }
  }
}

function runEngine(testCase: Case): { maxRent: Cents; maxIncrease: Cents } | null {
  const query: RentQuery = {
    tenancyKind: "private",
    previousSetting: parseDate(testCase.previousSetting),
    previousRent: cents(testCase.rentCents),
    newSetting: parseDate(testCase.newSetting),
    newBuildExemption: testCase.newBuild ? "yes" : "no",
    asOf: parseDate(testCase.newSetting),
  };
  const result = evaluateRent(query, CPI);
  if (result.outcome !== "capped") {
    return null;
  }
  return { maxRent: result.headline.maxRent, maxIncrease: result.headline.maxIncrease };
}

function runOracle(testCase: Case): { maxRentCents: number; maxIncreaseCents: number } | null {
  const result = rtbCalculate(
    {
      currentRent: testCase.rentCents / 100,
      lastSetDate: testCase.previousSetting,
      newSetDate: testCase.newSetting,
      isPost10June2025Development: testCase.newBuild,
    },
    CPI_ROWS,
  );
  if (result.newRent === null || result.maxIncrease === null) {
    return null;
  }
  return {
    maxRentCents: Math.round(result.newRent * 100),
    maxIncreaseCents: Math.round(result.maxIncrease * 100),
  };
}

interface Disagreement {
  readonly testCase: Case;
  readonly engineCents: number;
  readonly oracleCents: number;
}

describe("differential: the engine against the RTB algorithm", () => {
  const cases = [...sweep()];
  const disagreements: Disagreement[] = [];
  let compared = 0;

  for (const testCase of cases) {
    const engine = runEngine(testCase);
    const oracle = runOracle(testCase);
    if (engine === null || oracle === null) {
      continue;
    }
    compared += 1;
    if (engine.maxRent !== oracle.maxRentCents) {
      disagreements.push({
        testCase,
        engineCents: engine.maxRent,
        oracleCents: oracle.maxRentCents,
      });
    }
  }

  it("compares a case set large enough for the number to mean something", () => {
    expect(cases.length).toBeGreaterThan(2000);
    expect(compared).toBeGreaterThan(2000);
  });

  it("agrees with the RTB algorithm on the maximum rent, exactly, in every case", () => {
    const report = disagreements
      .slice(0, 10)
      .map(
        (d) =>
          `  ${d.testCase.previousSetting} -> ${d.testCase.newSetting}, rent ${formatEuro(
            cents(d.testCase.rentCents),
          )}, newBuild=${d.testCase.newBuild}: engine ${d.engineCents}c vs oracle ${d.oracleCents}c`,
      )
      .join("\n");
    expect(
      disagreements.length,
      `${disagreements.length} of ${compared} cases disagreed:\n${report}`,
    ).toBe(0);
  });

  it("agrees on the maximum increase, which is the figure the RTB actually displays", () => {
    const mismatches: string[] = [];
    for (const testCase of cases) {
      const engine = runEngine(testCase);
      const oracle = runOracle(testCase);
      if (engine === null || oracle === null) continue;
      if (engine.maxIncrease !== oracle.maxIncreaseCents) {
        mismatches.push(
          `${testCase.previousSetting} -> ${testCase.newSetting}: ${engine.maxIncrease}c vs ${oracle.maxIncreaseCents}c`,
        );
      }
    }
    expect(mismatches.slice(0, 10).join("\n")).toBe("");
  });

  it("reports the agreement rate", () => {
    const rate = ((compared - disagreements.length) / compared) * 100;
    // Recorded in docs/measurements/02-engine-agreement.md. This assertion exists so the
    // number in that document cannot silently drift away from the code.
    expect(rate).toBe(100);
    expect(compared).toBeGreaterThan(2000);
  });
});

describe("the oracle itself behaves like the official tool", () => {
  it("reproduces the worked example", () => {
    const result = rtbCalculate(
      {
        currentRent: 2000,
        lastSetDate: "2025-06-01",
        newSetDate: "2026-09-01",
        isPost10June2025Development: false,
      },
      CPI_ROWS,
    );
    expect(result.months).toBe(15);
    expect(result.capPctProRata).toBeCloseTo(2.5, 9);
    expect(result.changePct).toBeCloseTo(3.4918, 4);
    expect(result.capped2pc).toBe(true);
    expect(result.newRent).toBe(2050);
    expect(result.maxIncrease).toBe(50);
    expect(result.cpiNext?.usedFallback).toBe(true);
  });

  it("drops the 2 per cent cap for a post 10 June 2025 development", () => {
    const result = rtbCalculate(
      {
        currentRent: 2000,
        lastSetDate: "2025-06-01",
        newSetDate: "2026-09-01",
        isPost10June2025Development: true,
      },
      CPI_ROWS,
    );
    expect(result.capped2pc).toBe(false);
    expect(result.pctApplied).toBeCloseTo(3.4918, 4);
    expect(result.newRent).toBe(2069.84);
  });

  it("floors a CPI fall at zero", () => {
    const result = rtbCalculate(
      {
        currentRent: 1000,
        lastSetDate: "2025-12-01",
        newSetDate: "2026-01-01",
        isPost10June2025Development: true,
      },
      CPI_ROWS,
    );
    // December 2025 is 104.2, January 2026 is 103.3.
    expect(result.changePct).toBe(0);
    expect(result.newRent).toBe(1000);
    expect(result.maxIncrease).toBe(0);
  });
});

/** Naive but obviously correct, which is what a test generator should be. */
function addDays(from: { y: number; m: number; d: number }, days: number) {
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = (y: number, m: number) =>
    [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
  let { y, m, d } = from;
  for (let i = 0; i < days; i += 1) {
    d += 1;
    if (d > dim(y, m)) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return { y, m, d };
}
