import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDate, parseDate } from "../src/dates";
import { evaluateRent } from "../src/evaluate";
import { cents } from "../src/money";
import { CPI } from "./fixtures";
import { rtbCalculate } from "./rtb-oracle";

/**
 * Produces the numbers quoted in `docs/measurements/02-engine-agreement.md`, and writes
 * the summary to `data/vectors/agreement-summary.json` so the document and the code cannot
 * drift apart.
 *
 * It also answers the question that makes a 100 per cent agreement rate worth anything:
 * would this harness notice if the two implementations disagreed? The statutory basis is
 * run through the same comparison as a control. It differs from the RTB by construction,
 * so if the harness reports zero disagreements there too, the harness is broken rather than
 * the engine being right.
 */

const CPI_ROWS = CPI.series.map((r) => ({ month: r.month, value: r.value }));

const STARTS = [
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
const OFFSETS = [1, 27, 28, 29, 30, 31, 59, 89, 90, 180, 364, 365, 366, 400, 456, 730, 1096];
const RENTS = [1, 50_000, 95_050, 100_000, 123_435, 175_055, 200_000, 999_999];

interface Stats {
  compared: number;
  headlineDisagreements: number;
  statutoryDisagreements: number;
  percentageBinding: number;
  indexBinding: number;
  usedCpiFallback: number;
  newBuildCases: number;
  zeroIncreaseCases: number;
  maxStatutoryGapCents: number;
  /** Signed gaps, statutory minus RTB, for every case where they differ. */
  gaps: number[];
}

function collect(): Stats {
  const stats: Stats = {
    compared: 0,
    headlineDisagreements: 0,
    statutoryDisagreements: 0,
    percentageBinding: 0,
    indexBinding: 0,
    usedCpiFallback: 0,
    newBuildCases: 0,
    zeroIncreaseCases: 0,
    maxStatutoryGapCents: 0,
    gaps: [],
  };

  for (const start of STARTS) {
    for (const offset of OFFSETS) {
      for (const rentCents of RENTS) {
        for (const newBuild of [false, true]) {
          const previous = parseDate(start);
          const next = addDays(previous, offset);
          const nextIso = formatDate(next);

          const result = evaluateRent(
            {
              tenancyKind: "private",
              previousSetting: previous,
              previousRent: cents(rentCents),
              newSetting: next,
              newBuildExemption: newBuild ? "yes" : "no",
              asOf: next,
            },
            CPI,
          );
          if (result.outcome !== "capped") continue;

          const oracle = rtbCalculate(
            {
              currentRent: rentCents / 100,
              lastSetDate: start,
              newSetDate: nextIso,
              isPost10June2025Development: newBuild,
            },
            CPI_ROWS,
          );
          if (oracle.newRent === null) continue;

          const oracleCents = Math.round(oracle.newRent * 100);
          stats.compared += 1;
          if (result.headline.maxRent !== oracleCents) stats.headlineDisagreements += 1;
          if (result.statutory.maxRent !== oracleCents) {
            stats.statutoryDisagreements += 1;
            const signed = result.statutory.maxRent - oracleCents;
            stats.gaps.push(signed);
            if (Math.abs(signed) > stats.maxStatutoryGapCents) {
              stats.maxStatutoryGapCents = Math.abs(signed);
            }
          }
          if (result.headline.bindingConstraint === "percentage") stats.percentageBinding += 1;
          if (result.headline.bindingConstraint === "index") stats.indexBinding += 1;
          if (result.headline.currentCpi?.usedFallback === true) stats.usedCpiFallback += 1;
          if (newBuild) stats.newBuildCases += 1;
          if (result.headline.maxIncrease === 0) stats.zeroIncreaseCases += 1;
        }
      }
    }
  }

  return stats;
}

describe("agreement report", () => {
  const stats = collect();

  it("exercises both binding constraints, not just one", () => {
    expect(stats.percentageBinding).toBeGreaterThan(100);
    expect(stats.indexBinding).toBeGreaterThan(100);
  });

  it("exercises the publication-lag fallback and the zero-increase path", () => {
    expect(stats.usedCpiFallback).toBeGreaterThan(0);
    expect(stats.zeroIncreaseCases).toBeGreaterThan(0);
  });

  it("agrees with the RTB on the headline figure in every case", () => {
    expect(stats.headlineDisagreements).toBe(0);
  });

  it("HAS THE POWER TO DETECT A DIFFERENCE: the statutory basis does disagree", () => {
    // If this were also zero, the comparison would be vacuous and the 100 per cent above
    // would mean nothing. The statutory reading differs from the RTB by construction, so
    // seeing it flagged here is what makes the headline result credible.
    expect(stats.statutoryDisagreements).toBeGreaterThan(0);
    expect(stats.maxStatutoryGapCents).toBeGreaterThan(0);
  });

  it("the divergence is material, and runs in both directions", () => {
    const dist = gapDistribution(stats.gaps);
    // Guards the claim in docs/measurements/02. If a future change makes the two readings
    // agree closely, that is a finding and this test should be updated deliberately.
    expect(dist.median).toBeGreaterThan(100);
    expect(dist.max).toBeGreaterThan(10_000);
    expect(dist.statutoryHigher).toBeGreaterThan(0);
    expect(dist.statutoryLower).toBeGreaterThan(0);
  });

  it("writes the summary the measurement document quotes", () => {
    const summary = {
      generatedBy: "packages/rules/tests/agreement-report.test.ts",
      oracle: {
        source: "https://rtb.ie/wp-content/themes/rtb/assets/rent-calc/Scripts/rent-calc.js",
        sha256: "1f7a50b86efaba3197232cce6a3d8f86b3f08a651d3a8e6673b6bf83b01432d7",
        retrieved: "2026-09-06",
      },
      casesCompared: stats.compared,
      headlineAgreementPercent: Number(
        (((stats.compared - stats.headlineDisagreements) / stats.compared) * 100).toFixed(4),
      ),
      headlineDisagreements: stats.headlineDisagreements,
      statutoryDisagreements: stats.statutoryDisagreements,
      statutoryDisagreementPercent: Number(
        ((stats.statutoryDisagreements / stats.compared) * 100).toFixed(4),
      ),
      statutoryGapCents: gapDistribution(stats.gaps),
      coverage: {
        percentageCapBinding: stats.percentageBinding,
        indexCapBinding: stats.indexBinding,
        usedCpiPublicationFallback: stats.usedCpiFallback,
        newBuildExemptCases: stats.newBuildCases,
        zeroIncreaseCases: stats.zeroIncreaseCases,
      },
    };

    const out = join(import.meta.dirname, "..", "..", "..", "data", "vectors");
    writeFileSync(join(out, "agreement-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

    // Surfaced in the test output so the number is visible without opening the file.
    console.log(JSON.stringify(summary, null, 2));
    expect(summary.casesCompared).toBeGreaterThan(2000);
  });
});

/**
 * How far apart the two readings actually are, and in which direction.
 *
 * This is the number that changed the design. A single worked example suggested the
 * divergence was a rounding difference of a few cent. Across the sweep the median is over
 * four euro a month and the tail reaches three figures, and the sign goes both ways, which
 * means the official calculator sometimes permits more than a strict reading of section
 * 19(4) allows. See docs/measurements/02-engine-agreement.md.
 */
function gapDistribution(gaps: number[]) {
  const magnitudes = gaps.map((g) => Math.abs(g)).sort((a, b) => a - b);
  const at = (p: number) =>
    magnitudes[Math.min(magnitudes.length - 1, Math.floor(magnitudes.length * p))] ?? 0;
  return {
    count: gaps.length,
    median: at(0.5),
    p90: at(0.9),
    p99: at(0.99),
    max: magnitudes[magnitudes.length - 1] ?? 0,
    withinFiveCent: magnitudes.filter((g) => g <= 5).length,
    statutoryHigher: gaps.filter((g) => g > 0).length,
    statutoryLower: gaps.filter((g) => g < 0).length,
  };
}

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
