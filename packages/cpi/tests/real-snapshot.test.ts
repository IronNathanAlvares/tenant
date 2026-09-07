import { evaluateRent, formatEuro, parseDate, parseEuro } from "@tenant/rules";
import { describe, expect, it } from "vitest";
import { CPI_PROVENANCE, CPI_SNAPSHOT } from "../src/index";

/**
 * The fixture tests prove the engine is internally consistent. These prove it works
 * against the actual 357 month snapshot the site will ship, which is the thing that
 * catches a broken ingest, a wrong series, or a shape change in the CSO response.
 */

describe("the pinned snapshot", () => {
  it("is the series the RTB names, not the one you find first", () => {
    expect(CPI_PROVENANCE.table).toBe("CPM24");
    expect(CPI_PROVENANCE.statistic).toBe("CPM24C01");
    expect(CPI_PROVENANCE.subIndex).toBe("CP00");
  });

  it("covers the whole period the rules can reach back into", () => {
    expect(CPI_SNAPSHOT.series.length).toBeGreaterThan(300);
    expect(CPI_SNAPSHOT.series[0]?.month).toBe("1996-11");
    expect(CPI_SNAPSHOT.base).toBe("December 2023 = 100");
  });

  it("carries the values the RTB renders on its own calculator page", () => {
    // Spot checked by eye against the CPI Index Table at rtb.ie/rtb-rent-calculator.
    const expected: Record<string, number> = {
      "2025-06": 103.1,
      "2025-12": 104.2,
      "2026-01": 103.3,
      "2026-02": 104.2,
      "2026-03": 105.9,
      "2026-07": 106.7,
    };
    for (const [month, value] of Object.entries(expected)) {
      const row = CPI_SNAPSHOT.series.find((r) => r.month === month);
      expect(row?.value, `CPI for ${month}`).toBe(value);
    }
  });

  it("records a hash so a determination can name the data it used", () => {
    expect(CPI_SNAPSHOT.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the worked example, against the real snapshot", () => {
  const result = evaluateRent(
    {
      tenancyKind: "private",
      previousSetting: parseDate("2025-06-01"),
      previousRent: parseEuro("2000"),
      newSetting: parseDate("2026-09-01"),
      newBuildExemption: "no",
      asOf: parseDate("2026-09-01"),
    },
    CPI_SNAPSHOT,
  );

  it("gives 2050.00, the same as the RTB calculator", () => {
    if (result.outcome !== "capped") throw new Error(`expected capped, got ${result.outcome}`);
    expect(formatEuro(result.headline.maxRent)).toBe("2050.00");
    expect(formatEuro(result.headline.maxIncrease)).toBe("50.00");
  });

  it("names the snapshot it used", () => {
    expect(result.provenance.cpiSnapshotSha256).toBe(CPI_SNAPSHOT.sha256);
    expect(result.provenance.cpiLatestMonth).toBe(CPI_SNAPSHOT.latestMonth);
  });
});

describe("a rent set under the new regime, where the asymmetry bites", () => {
  // Previous setting on 10 April 2026 is after commencement, so the statutory basis takes
  // March CPI (105.9) while the RTB takes April (106.4). This is the case no other tool
  // distinguishes. R-CPI-05.
  const result = evaluateRent(
    {
      tenancyKind: "private",
      previousSetting: parseDate("2026-04-10"),
      previousRent: parseEuro("1800"),
      newSetting: parseDate("2027-05-10"),
      newBuildExemption: "yes", // CPI only, so the index cap is the visible one
      asOf: parseDate("2027-05-10"),
    },
    CPI_SNAPSHOT,
  );

  it("picks different CPI months on the two bases", () => {
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.headline.previousCpi?.value).toBe(106.4);
    expect(result.statutory.previousCpi?.value).toBe(105.9);
  });

  it("produces different maximums, and says so", () => {
    if (result.outcome !== "capped") throw new Error("expected capped");
    expect(result.basesAgree).toBe(false);
    expect(result.headline.maxRent).not.toBe(result.statutory.maxRent);
  });
});
