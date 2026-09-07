import { describe, expect, it } from "vitest";
import { cpiChangePercent, currentCpiNumber, lookupCpi, previousCpiNumber } from "../src/cpi";
import { parseDate } from "../src/dates";
import { CPI } from "./fixtures";

describe("lookupCpi, R-CPI-02", () => {
  it("returns the exact month when it is published", () => {
    const reading = lookupCpi(CPI, { y: 2026, m: 2 });
    expect(reading?.value).toBe(104.2);
    expect(reading?.usedFallback).toBe(false);
  });

  it("walks back and says so when the month is not published yet", () => {
    // The fixture ends at 2026-07. Asking for September falls back.
    const reading = lookupCpi(CPI, { y: 2026, m: 9 });
    expect(reading?.value).toBe(106.7);
    expect(reading?.month).toEqual({ y: 2026, m: 7 });
    expect(reading?.usedFallback).toBe(true);
    expect(reading?.requested).toEqual({ y: 2026, m: 9 });
  });

  it("returns null when nothing at or before the month exists", () => {
    expect(lookupCpi(CPI, { y: 1990, m: 1 })).toBeNull();
  });
});

describe("currentCpiNumber, R-CPI-03 and R-CPI-04", () => {
  const newSetting = parseDate("2026-06-15");

  it("RTB basis takes the month of the setting", () => {
    const reading = currentCpiNumber(CPI, newSetting, "rtb");
    expect(reading?.month).toEqual({ y: 2026, m: 6 });
    expect(reading?.value).toBe(106.6);
  });

  it("statutory basis takes the month before the setting", () => {
    const reading = currentCpiNumber(CPI, newSetting, "statute");
    expect(reading?.month).toEqual({ y: 2026, m: 5 });
    expect(reading?.value).toBe(106.3);
  });
});

describe("previousCpiNumber, R-CPI-05, the asymmetry", () => {
  it("takes the month OF a setting made before 1 March 2026", () => {
    const reading = previousCpiNumber(CPI, parseDate("2025-06-01"), "statute");
    expect(reading?.month).toEqual({ y: 2025, m: 6 });
    expect(reading?.value).toBe(103.1);
    expect(reading?.usedFallback).toBe(false);
  });

  it("takes the month BEFORE a setting made on or after 1 March 2026", () => {
    const reading = previousCpiNumber(CPI, parseDate("2026-04-10"), "statute");
    expect(reading?.month).toEqual({ y: 2026, m: 3 });
    expect(reading?.value).toBe(105.9);
  });

  it("switches behaviour exactly at 1 March 2026, not a day either side", () => {
    const dayBefore = previousCpiNumber(CPI, parseDate("2026-02-28"), "statute");
    const onTheDay = previousCpiNumber(CPI, parseDate("2026-03-01"), "statute");
    expect(dayBefore?.month).toEqual({ y: 2026, m: 2 });
    expect(onTheDay?.month).toEqual({ y: 2026, m: 2 });
    // Same month by coincidence of the boundary, but reached by different rules.
    const laterInMarch = previousCpiNumber(CPI, parseDate("2026-03-31"), "statute");
    expect(laterInMarch?.month).toEqual({ y: 2026, m: 2 });
    const april = previousCpiNumber(CPI, parseDate("2026-04-01"), "statute");
    expect(april?.month).toEqual({ y: 2026, m: 3 });
  });

  it("RTB basis ignores the asymmetry entirely", () => {
    const before = previousCpiNumber(CPI, parseDate("2025-06-01"), "rtb");
    const after = previousCpiNumber(CPI, parseDate("2026-04-10"), "rtb");
    expect(before?.month).toEqual({ y: 2025, m: 6 });
    expect(after?.month).toEqual({ y: 2026, m: 4 });
  });

  it("the two bases disagree for a post-commencement previous setting", () => {
    const setting = parseDate("2026-04-10");
    const rtb = previousCpiNumber(CPI, setting, "rtb");
    const statute = previousCpiNumber(CPI, setting, "statute");
    expect(rtb?.value).toBe(106.4);
    expect(statute?.value).toBe(105.9);
    expect(rtb?.value).not.toBe(statute?.value);
  });
});

describe("cpiChangePercent, R-CPI-07", () => {
  const at = (y: number, m: number) => {
    const reading = lookupCpi(CPI, { y, m });
    if (reading === null) throw new Error("fixture gap");
    return reading;
  };

  it("computes the worked example change", () => {
    const change = cpiChangePercent(at(2025, 6), at(2026, 7));
    expect(change).toBeCloseTo(3.4918, 4);
  });

  it("floors deflation at zero rather than mandating a reduction", () => {
    // December 2025 is 104.2 and January 2026 is 103.3, a genuine fall.
    expect(cpiChangePercent(at(2025, 12), at(2026, 1))).toBe(0);
  });

  it("is zero when the previous value is zero rather than dividing by it", () => {
    const zero = { ...at(2025, 6), value: 0 };
    expect(cpiChangePercent(zero, at(2026, 7))).toBe(0);
  });
});
