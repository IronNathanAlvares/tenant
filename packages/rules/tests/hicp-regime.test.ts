import { describe, expect, it } from "vitest";
import type { CpiSnapshot } from "../src/cpi";
import { HICP_REGIME_START, previousHicpNumber, WHOLE_STATE_DEEMED_RPZ } from "../src/cpi";
import { parseDate } from "../src/dates";
import { evaluateRent } from "../src/evaluate";
import { formatEuro, parseEuro } from "../src/money";
import type { RentQuery } from "../src/types";
import { CPI } from "./fixtures";

/**
 * The pre-2026 regime, section 19(6).
 *
 * A rent review notice served before 1 March 2026 is still governed by the law as it stood,
 * which used HICP rather than CPI. This is live law, not history, and it was deliberately
 * left unbuilt through three sprints because the operative index series could not be
 * confirmed and guessing it would have been a confidently wrong answer in the one place a
 * wrong answer is least recoverable.
 *
 * It is confirmed now. Section 6 of the Residential Tenancies (No. 2) Act 2021 defines HICP
 * values as "the All-Items Harmonised Index of Consumer Prices in relation to Ireland ...
 * published monthly by the Central Statistics Office in accordance with Regulation (EU)
 * 2016/792", which is CSO table CPM23, statistic CPM23C01, sub index CP00.
 */

/** Real HICP values from CPM23C01/CP00, trimmed to what these tests reach. */
const HICP: CpiSnapshot = {
  sha256: "test-fixture-not-the-real-snapshot",
  base: "December 2023 = 100",
  latestMonth: "2026-02",
  series: [
    { month: "2021-10", value: 86.6 },
    { month: "2021-11", value: 87.03 },
    { month: "2021-12", value: 87.44 },
    { month: "2022-01", value: 87.0 },
    { month: "2022-06", value: 92.7 },
    { month: "2023-06", value: 97.2 },
    { month: "2024-06", value: 98.66 },
    { month: "2024-12", value: 99.8 },
    { month: "2025-01", value: 99.2 },
    { month: "2025-06", value: 100.22 },
    { month: "2025-12", value: 100.9 },
    { month: "2026-01", value: 100.4 },
    { month: "2026-02", value: 101.09 },
  ],
};

function query(overrides: Partial<RentQuery> = {}): RentQuery {
  return {
    tenancyKind: "private",
    previousSetting: parseDate("2024-06-01"),
    previousRent: parseEuro("1500"),
    newSetting: parseDate("2025-09-01"),
    newBuildExemption: "no",
    // Served before 1 March 2026, which is what sends this down the section 19(6) path.
    noticeServed: parseDate("2025-05-01"),
    asOf: parseDate("2025-09-01"),
    ...overrides,
  };
}

describe("without the HICP data, it still refuses", () => {
  it("does not fall back to the CPI table, which would be a wrong answer", () => {
    const result = evaluateRent(query(), CPI);
    expect(result.outcome).toBe("not-answerable");
    if (result.outcome !== "not-answerable") return;
    expect(result.detail).toContain("HICP");
    expect(result.detail).toContain("Threshold");
  });
});

describe("with the HICP data, it answers", () => {
  const result = evaluateRent(query(), CPI, HICP);

  it("produces a capped determination rather than refusing", () => {
    expect(result.outcome).toBe("capped");
  });

  it("uses HICP, not CPI", () => {
    if (result.outcome !== "capped") throw new Error("expected capped");
    // June 2024 HICP is 98.66. The CPI figure for that month is a different number
    // entirely, so this asserts the right table was consulted.
    expect(result.headline.previousCpi?.value).toBe(98.66);
    expect(result.headline.previousCpi?.value).not.toBe(101.3);
  });

  it("records the HICP snapshot on the determination, not the CPI one", () => {
    expect(result.provenance.cpiSnapshotSha256).toBe(HICP.sha256);
    expect(result.provenance.cpiLatestMonth).toBe(HICP.latestMonth);
  });

  it("applies both constraints, with the lower binding", () => {
    if (result.outcome !== "capped") throw new Error("expected capped");
    // 15 whole months elapsed, so the percentage cap is 2.5%.
    expect(result.headline.percentageCap?.percent).toBeCloseTo(2.5, 6);
    // HICP June 2024 98.66 to August 2025, falling back to June 2025 at 100.22: +1.58%.
    expect(result.headline.indexCap?.percent).toBeCloseTo(1.5813, 3);
    expect(result.headline.bindingConstraint).toBe("index");
    expect(formatEuro(result.headline.maxRent)).toBe("1523.72");
  });

  it("cites section 19(6)", () => {
    expect(result.citations.some((c) => c.provision === "s. 19(6)")).toBe(true);
  });
});

describe("the HICP asymmetry pivots on 11 December 2021, not 1 March 2026", () => {
  it("takes the month OF a setting before the 2021 commencement", () => {
    const reading = previousHicpNumber(HICP, parseDate("2021-11-20"), "statute");
    expect(reading?.month).toEqual({ y: 2021, m: 11 });
    expect(reading?.value).toBe(87.03);
  });

  it("takes the month BEFORE a setting on or after it", () => {
    const reading = previousHicpNumber(HICP, parseDate("2022-01-15"), "statute");
    expect(reading?.month).toEqual({ y: 2021, m: 12 });
    expect(reading?.value).toBe(87.44);
  });

  it("switches on the commencement date itself", () => {
    expect(HICP_REGIME_START).toEqual({ y: 2021, m: 12, d: 11 });
    const dayBefore = previousHicpNumber(HICP, parseDate("2021-12-10"), "statute");
    const onTheDay = previousHicpNumber(HICP, parseDate("2021-12-11"), "statute");
    expect(dayBefore?.month).toEqual({ y: 2021, m: 12 });
    expect(onTheDay?.month).toEqual({ y: 2021, m: 11 });
  });
});

describe("rent pressure zone geography, which only matters before 20 June 2025", () => {
  it("does not ask once the whole State is deemed a zone", () => {
    expect(WHOLE_STATE_DEEMED_RPZ).toEqual({ y: 2025, m: 6, d: 20 });
    // The default query sets rent in September 2025, after the deeming.
    const result = evaluateRent(query(), CPI, HICP);
    expect(result.outcome).toBe("capped");
  });

  it("asks, rather than assumes, for a setting before that date", () => {
    const result = evaluateRent(
      query({ newSetting: parseDate("2024-12-01"), asOf: parseDate("2024-12-01") }),
      CPI,
      HICP,
    );
    expect(result.outcome).toBe("unknown");
    if (result.outcome !== "unknown") return;
    expect(result.question).toContain("Rent Pressure Zone");
    expect(result.howToFindOut).toContain("rtb.ie");
    expect(result.branches).toHaveLength(2);
  });

  it("computes a real figure on the in-a-zone branch", () => {
    const result = evaluateRent(
      query({
        newSetting: parseDate("2024-12-01"),
        asOf: parseDate("2024-12-01"),
        inRentPressureZone: "yes",
      }),
      CPI,
      HICP,
    );
    expect(result.outcome).toBe("capped");
  });

  it("says no cap applied where the dwelling was outside a zone", () => {
    const result = evaluateRent(
      query({
        newSetting: parseDate("2024-12-01"),
        asOf: parseDate("2024-12-01"),
        inRentPressureZone: "no",
      }),
      CPI,
      HICP,
    );
    expect(result.outcome).toBe("no-cap");
    if (result.outcome !== "no-cap") return;
    expect(result.explanation).toContain("Rent Pressure Zone");
    expect(result.explanation).toContain("market rent");
  });
});

describe("the boundary between the two regimes", () => {
  it("a notice served on 28 February 2026 goes to HICP", () => {
    const result = evaluateRent(
      query({ noticeServed: parseDate("2026-02-28"), newSetting: parseDate("2026-06-01") }),
      CPI,
      HICP,
    );
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.provenance.cpiSnapshotSha256).toBe(HICP.sha256);
  });

  it("a notice served on 1 March 2026 goes to CPI", () => {
    const result = evaluateRent(
      query({ noticeServed: parseDate("2026-03-01"), newSetting: parseDate("2026-06-01") }),
      CPI,
      HICP,
    );
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.provenance.cpiSnapshotSha256).toBe(CPI.sha256);
  });

  it("a query with no notice date at all uses the current regime", () => {
    const { noticeServed: _omitted, ...withoutNotice } = query();
    const result = evaluateRent(withoutNotice, CPI, HICP);
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.provenance.cpiSnapshotSha256).toBe(CPI.sha256);
  });
});
