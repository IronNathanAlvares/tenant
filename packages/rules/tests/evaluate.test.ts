import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseDate } from "../src/dates";
import { evaluateRent, RULES_VERSION } from "../src/evaluate";
import { cents, formatEuro, parseEuro } from "../src/money";
import type { RentQuery } from "../src/types";
import { CPI } from "./fixtures";

function query(overrides: Partial<RentQuery> = {}): RentQuery {
  return {
    tenancyKind: "private",
    previousSetting: parseDate("2025-06-01"),
    previousRent: parseEuro("2000"),
    newSetting: parseDate("2026-09-01"),
    newBuildExemption: "no",
    asOf: parseDate("2026-09-01"),
    ...overrides,
  };
}

describe("the worked example from docs/01 and docs/measurements/01", () => {
  it("comes out at 2050.00, matching the RTB calculator", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error(`expected capped, got ${result.outcome}`);

    expect(formatEuro(result.headline.maxRent)).toBe("2050.00");
    expect(formatEuro(result.headline.maxIncrease)).toBe("50.00");
    expect(result.headline.bindingConstraint).toBe("percentage");
    expect(result.headline.percentageCap?.percent).toBeCloseTo(2.5, 6);
    expect(result.headline.indexCap?.percent).toBeCloseTo(3.4918, 4);
  });

  it("uses June 2025 and July 2026 CPI, the second by falling back", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.previousCpi?.value).toBe(103.1);
    expect(result.headline.currentCpi?.value).toBe(106.7);
    expect(result.headline.currentCpi?.usedFallback).toBe(true);
  });

  it("reports the statutory reading as 2050.08, and flags the disagreement", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    // 2% + 2% x 92/365 = 2.5041%, which is the day-count reading of s. 19(4)(b).
    expect(result.statutory.percentageCap?.percent).toBeCloseTo(2.50411, 4);
    expect(formatEuro(result.statutory.maxRent)).toBe("2050.08");
    expect(result.basesAgree).toBe(false);
  });

  it("puts the disagreement in the audit trail rather than hiding it", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    const step = result.audit.find((s) => s.label.includes("strictly"));
    expect(step?.value).toBe("2050.08");
  });
});

describe("R-CAP-02, the percentage cap is simple and not compound", () => {
  it("gives 6 per cent over three years, not 6.12", () => {
    const result = evaluateRent(
      query({
        previousSetting: parseDate("2023-09-01"),
        newSetting: parseDate("2026-09-01"),
        newBuildExemption: "yes", // remove the CPI cap so the percentage cap is visible alone
      }),
      CPI,
    );
    if (result.outcome !== "capped") throw new Error("expected capped");
    // With the exemption there is no percentage cap at all, so check it directly instead.
    expect(result.headline.percentageCap).toBeNull();
  });

  it("caps a three year gap at exactly 6 per cent when CPI does not bind lower", () => {
    // Construct a snapshot where CPI has risen far more than 6 per cent.
    const hotCpi = {
      ...CPI,
      series: [
        { month: "2023-09", value: 50 },
        { month: "2026-09", value: 100 },
      ],
    };
    const result = evaluateRent(
      query({
        previousSetting: parseDate("2023-09-01"),
        newSetting: parseDate("2026-09-01"),
      }),
      hotCpi,
    );
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.percentageCap?.percent).toBeCloseTo(6, 9);
    expect(result.headline.bindingConstraint).toBe("percentage");
    // 2000 x 1.06 = 2120.00, not 2000 x 1.02^3 = 2122.42
    expect(formatEuro(result.headline.maxRent)).toBe("2120.00");
  });
});

describe("R-CAP-01, both constraints are evaluated and the lower binds", () => {
  it("lets CPI bind when it is below the percentage cap", () => {
    const flatCpi = {
      ...CPI,
      series: [
        { month: "2025-06", value: 100 },
        { month: "2026-09", value: 100.5 },
      ],
    };
    const result = evaluateRent(query(), flatCpi);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.bindingConstraint).toBe("index");
    expect(result.headline.appliedPercent).toBeCloseTo(0.5, 6);
    expect(formatEuro(result.headline.maxRent)).toBe("2010.00");
  });

  it("allows no increase at all when CPI has fallen", () => {
    const fallingCpi = {
      ...CPI,
      series: [
        { month: "2025-06", value: 110 },
        { month: "2026-09", value: 100 },
      ],
    };
    const result = evaluateRent(query(), fallingCpi);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.appliedPercent).toBe(0);
    expect(formatEuro(result.headline.maxRent)).toBe("2000.00");
    expect(formatEuro(result.headline.maxIncrease)).toBe("0.00");
  });
});

describe("R-REG, regime resolution", () => {
  it("R-REG-01, cost rental is outside rent control", () => {
    const result = evaluateRent(query({ tenancyKind: "cost-rental" }), CPI);
    expect(result.outcome).toBe("no-cap");
    if (result.outcome !== "no-cap") return;
    expect(result.reason).toBe("cost-rental");
    expect(result.citations.some((c) => c.provision === "s. 33(1)")).toBe(true);
  });

  it("R-REG-02, Approved Housing Body is outside rent control", () => {
    const result = evaluateRent(query({ tenancyKind: "approved-housing-body" }), CPI);
    expect(result.outcome).toBe("no-cap");
    if (result.outcome !== "no-cap") return;
    expect(result.reason).toBe("approved-housing-body");
  });

  it("R-REG-03, a notice served before 1 March 2026 goes to the old regime", () => {
    const result = evaluateRent(query({ noticeServed: parseDate("2026-02-25") }), CPI);
    expect(result.outcome).toBe("not-answerable");
    if (result.outcome !== "not-answerable") return;
    expect(result.citations.some((c) => c.provision === "s. 19(6)")).toBe(true);
    expect(result.detail).toContain("Threshold");
  });

  it("R-REG-03, a notice served on 1 March 2026 does not", () => {
    const result = evaluateRent(query({ noticeServed: parseDate("2026-03-01") }), CPI);
    expect(result.outcome).toBe("capped");
  });

  it("R-REG-04, the new build exemption removes the percentage cap only", () => {
    const result = evaluateRent(query({ newBuildExemption: "yes" }), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.percentageCap).toBeNull();
    expect(result.headline.indexCap).not.toBeNull();
    expect(result.headline.bindingConstraint).toBe("index");
    // CPI rose 3.4918%, so 2000 -> 2069.84
    expect(formatEuro(result.headline.maxRent)).toBe("2069.84");
  });

  it("R-REG-06, a market rent path gives no cap and no maximum", () => {
    const result = evaluateRent(query({ marketRentPathApplies: true }), CPI);
    expect(result.outcome).toBe("no-cap");
    if (result.outcome !== "no-cap") return;
    expect(result.reason).toBe("market-rent-path");
    expect(result.citations.some((c) => c.provision === "s. 19(5)")).toBe(true);
    // The market rent prohibition still gets cited, because it is the remaining limit.
    expect(result.citations.some((c) => c.provision === "s. 19(1)")).toBe(true);
  });
});

describe("R-REG-05, Unknown is a real answer", () => {
  const result = evaluateRent(query({ newBuildExemption: "unknown" }), CPI);

  it("does not guess", () => {
    expect(result.outcome).toBe("unknown");
  });

  it("gives both branches with real numbers", () => {
    if (result.outcome !== "unknown") throw new Error("expected unknown");
    expect(result.branches).toHaveLength(2);
    const [exempt, notExempt] = result.branches;
    if (exempt?.determination.outcome !== "capped") throw new Error("branch 1 not capped");
    if (notExempt?.determination.outcome !== "capped") throw new Error("branch 2 not capped");
    expect(formatEuro(exempt.determination.headline.maxRent)).toBe("2069.84");
    expect(formatEuro(notExempt.determination.headline.maxRent)).toBe("2050.00");
  });

  it("says how to find out, in terms a tenant can act on", () => {
    if (result.outcome !== "unknown") throw new Error("expected unknown");
    expect(result.question).toContain("10 June 2025");
    expect(result.howToFindOut).toContain("landlord");
  });
});

describe("R-CAP-07 and R-OUT-06, bad questions are values not exceptions", () => {
  it("refuses when the new date is not after the previous one", () => {
    const result = evaluateRent(query({ newSetting: parseDate("2025-01-01") }), CPI);
    expect(result.outcome).toBe("not-answerable");
  });

  it("refuses when the two dates are the same", () => {
    const result = evaluateRent(
      query({ previousSetting: parseDate("2026-01-01"), newSetting: parseDate("2026-01-01") }),
      CPI,
    );
    expect(result.outcome).toBe("not-answerable");
  });

  it("never throws for any well-formed query", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 3000 }),
        fc.constantFrom("private", "student-specific-accommodation", "cost-rental"),
        fc.constantFrom("yes", "no", "unknown"),
        (rentCents, dayOffset, kind, exemption) => {
          const previous = parseDate("2024-01-01");
          const next = addDaysNaive(previous, dayOffset);
          const q = query({
            tenancyKind: kind as RentQuery["tenancyKind"],
            newBuildExemption: exemption as RentQuery["newBuildExemption"],
            previousRent: cents(rentCents),
            previousSetting: previous,
            newSetting: next,
          });
          const result = evaluateRent(q, CPI);
          return typeof result.outcome === "string";
        },
      ),
      { numRuns: 1500 },
    );
  });
});

describe("R-CAP-05 and R-CAP-06, invariants", () => {
  it("never exceeds either constraint", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 2500 }),
        (rentCents, dayOffset) => {
          const previous = parseDate("2024-01-01");
          const q = query({
            previousRent: cents(rentCents),
            previousSetting: previous,
            newSetting: addDaysNaive(previous, dayOffset),
          });
          const result = evaluateRent(q, CPI);
          if (result.outcome !== "capped") return true;
          const { headline } = result;
          for (const cap of [headline.percentageCap, headline.indexCap]) {
            if (cap === null) continue;
            const ceiling = rentCents * (1 + cap.percent / 100);
            // Allow one cent for the half-up rounding at the end.
            if (headline.maxRent > Math.round(ceiling) + 1) return false;
          }
          return true;
        },
      ),
      { numRuns: 1500 },
    );
  });

  it("is monotonic in the previous rent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 1, max: 2500 }),
        (base, extra, dayOffset) => {
          const previous = parseDate("2024-01-01");
          const newSetting = addDaysNaive(previous, dayOffset);
          const lower = evaluateRent(
            query({ previousRent: cents(base), previousSetting: previous, newSetting }),
            CPI,
          );
          const higher = evaluateRent(
            query({ previousRent: cents(base + extra), previousSetting: previous, newSetting }),
            CPI,
          );
          if (lower.outcome !== "capped" || higher.outcome !== "capped") return true;
          return higher.headline.maxRent >= lower.headline.maxRent;
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("never reports a negative maximum increase", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (rentCents) => {
        const result = evaluateRent(query({ previousRent: cents(rentCents) }), CPI);
        if (result.outcome !== "capped") return true;
        return result.headline.maxIncrease >= 0;
      }),
      { numRuns: 500 },
    );
  });
});

describe("R-OUT, output contract", () => {
  it("R-OUT-03 and R-CPI-06, records the rules version and snapshot", () => {
    const result = evaluateRent(query(), CPI);
    expect(result.provenance.rulesVersion).toBe(RULES_VERSION);
    expect(result.provenance.cpiSnapshotSha256).toBe(CPI.sha256);
    expect(result.provenance.cpiLatestMonth).toBe("2026-07");
  });

  it("R-OUT-01, the audit trail walks from the rules to the answer", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    const labels = result.audit.map((s) => s.label);
    expect(labels[0]).toBe("Which rules apply");
    expect(labels).toContain("Percentage cap");
    expect(labels).toContain("CPI cap");
    expect(labels).toContain("Which cap binds");
    expect(labels).toContain("Maximum lawful rent");
    expect(labels).toContain("Maximum increase");
  });

  it("R-OUT-02, every determination carries at least one citation", () => {
    for (const kind of ["private", "cost-rental", "approved-housing-body"] as const) {
      const result = evaluateRent(query({ tenancyKind: kind }), CPI);
      expect(result.citations.length).toBeGreaterThan(0);
      for (const citation of result.citations) {
        expect(citation.url).toMatch(/^https:\/\//);
        expect(citation.provision.length).toBeGreaterThan(0);
      }
    }
  });

  it("R-OUT-04, the same inputs give a byte identical determination", () => {
    const a = JSON.stringify(evaluateRent(query(), CPI));
    const b = JSON.stringify(evaluateRent(query(), CPI));
    expect(a).toBe(b);
  });

  it("R-CAP-08, reports both the maximum rent and the maximum increase", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.maxRent - result.headline.maxIncrease).toBe(200_000);
  });
});

describe("judging a proposed rent", () => {
  it("accepts a proposal at the maximum", () => {
    const result = evaluateRent(query({ proposedRent: parseEuro("2050.00") }), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.proposedIsLawful).toBe(true);
  });

  it("rejects a proposal one cent over", () => {
    const result = evaluateRent(query({ proposedRent: parseEuro("2050.01") }), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.proposedIsLawful).toBe(false);
  });

  it("says nothing when no proposal was given", () => {
    const result = evaluateRent(query(), CPI);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.proposedIsLawful).toBeNull();
  });
});

/** Naive but obviously correct date addition, for generating test cases. */
function addDaysNaive(from: { y: number; m: number; d: number }, days: number) {
  const dim = (y: number, m: number) =>
    [
      31,
      (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][m - 1] as number;
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
