import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addMonths,
  addYears,
  compareDates,
  daysBetween,
  daysInMonth,
  formatDate,
  isLeapYear,
  monthLabel,
  parseDate,
  parseMonth,
  previousMonth,
  toDayNumber,
  wholeMonthsBetween,
  yearsAndRemainder,
} from "../src/dates";

describe("parseDate, R-DATE-04", () => {
  it("parses a valid date", () => {
    expect(parseDate("2026-03-01")).toEqual({ y: 2026, m: 3, d: 1 });
  });

  it("rejects an impossible day rather than rolling it over", () => {
    expect(() => parseDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseDate("2025-02-29")).toThrow(RangeError);
    expect(() => parseDate("2026-04-31")).toThrow(RangeError);
  });

  it("accepts 29 February in a leap year", () => {
    expect(parseDate("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it("rejects a bad month and malformed input", () => {
    expect(() => parseDate("2026-13-01")).toThrow(RangeError);
    expect(() => parseDate("2026-00-01")).toThrow(RangeError);
    for (const bad of ["", "2026-3-1", "01/03/2026", "not a date"]) {
      expect(() => parseDate(bad)).toThrow(SyntaxError);
    }
  });
});

describe("parseMonth", () => {
  it("round trips", () => {
    expect(parseMonth("2026-03")).toEqual({ y: 2026, m: 3 });
    expect(() => parseMonth("2026-13")).toThrow(RangeError);
    expect(() => parseMonth("2026-03-01")).toThrow(SyntaxError);
  });
});

describe("leap years and month lengths", () => {
  it("handles the century rules", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe("wholeMonthsBetween, R-DATE-03", () => {
  it("matches the RTB rule on the worked example", () => {
    // 1 June 2025 to 1 September 2026 is 15 whole months.
    expect(wholeMonthsBetween(parseDate("2025-06-01"), parseDate("2026-09-01"))).toBe(15);
  });

  it("does not count a final partial month", () => {
    // Same month index but an earlier day of month, so the last month has not completed.
    expect(wholeMonthsBetween(parseDate("2025-06-15"), parseDate("2026-06-14"))).toBe(11);
    expect(wholeMonthsBetween(parseDate("2025-06-15"), parseDate("2026-06-15"))).toBe(12);
    expect(wholeMonthsBetween(parseDate("2025-06-15"), parseDate("2026-06-16"))).toBe(12);
  });

  it("is zero for dates inside the same month", () => {
    expect(wholeMonthsBetween(parseDate("2026-01-05"), parseDate("2026-01-28"))).toBe(0);
  });
});

describe("addMonths and previousMonth", () => {
  it("crosses year boundaries in both directions", () => {
    expect(addMonths({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 });
    expect(addMonths({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths({ y: 2026, m: 6 }, -18)).toEqual({ y: 2024, m: 12 });
    expect(previousMonth({ y: 2026, m: 3 })).toEqual({ y: 2026, m: 2 });
  });

  it("never produces a month outside 1 to 12", () => {
    fc.assert(
      fc.property(fc.integer({ min: -400, max: 400 }), (delta) => {
        const result = addMonths({ y: 2026, m: 6 }, delta);
        return result.m >= 1 && result.m <= 12;
      }),
    );
  });
});

describe("day arithmetic", () => {
  it("counts days across a leap day", () => {
    expect(daysBetween(parseDate("2024-02-28"), parseDate("2024-03-01"))).toBe(2);
    expect(daysBetween(parseDate("2025-02-28"), parseDate("2025-03-01"))).toBe(1);
  });

  it("agrees with a known epoch offset", () => {
    expect(toDayNumber(parseDate("1970-01-01"))).toBe(0);
    expect(toDayNumber(parseDate("2000-01-01"))).toBe(10957);
  });

  it("is strictly ordered", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1990-01-01"), max: new Date("2060-12-31"), noInvalidDate: true }),
        fc.date({ min: new Date("1990-01-01"), max: new Date("2060-12-31"), noInvalidDate: true }),
        (a, b) => {
          const da = parseDate(a.toISOString().slice(0, 10));
          const db = parseDate(b.toISOString().slice(0, 10));
          return Math.sign(compareDates(da, db)) === Math.sign(toDayNumber(da) - toDayNumber(db));
        },
      ),
    );
  });
});

describe("addYears", () => {
  it("clamps 29 February into a non-leap year", () => {
    expect(addYears(parseDate("2024-02-29"), 1)).toEqual({ y: 2025, m: 2, d: 28 });
    expect(addYears(parseDate("2024-02-29"), 4)).toEqual({ y: 2028, m: 2, d: 29 });
  });
});

describe("yearsAndRemainder", () => {
  it("splits the worked example into a year and 92 days", () => {
    const split = yearsAndRemainder(parseDate("2025-06-01"), parseDate("2026-09-01"));
    expect(split.years).toBe(1);
    expect(split.remainderDays).toBe(92);
    expect(split.daysInRemainderYear).toBe(365);
  });

  it("returns a clean whole year with no remainder on an anniversary", () => {
    const split = yearsAndRemainder(parseDate("2025-03-01"), parseDate("2026-03-01"));
    expect(split.years).toBe(1);
    expect(split.remainderDays).toBe(0);
  });

  it("rejects a backwards interval", () => {
    expect(() => yearsAndRemainder(parseDate("2026-01-01"), parseDate("2025-01-01"))).toThrow(
      RangeError,
    );
  });

  it("never reports a remainder longer than the year it sits in", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4000 }), (offset) => {
        const from = parseDate("2020-01-15");
        const to = parseDate(
          formatDate({
            y: from.y,
            m: from.m,
            d: from.d,
          }),
        );
        const later = addDays(to, offset);
        const split = yearsAndRemainder(from, later);
        return split.remainderDays >= 0 && split.remainderDays < split.daysInRemainderYear;
      }),
    );
  });
});

describe("monthLabel", () => {
  it("reads the way a person writes it", () => {
    expect(monthLabel({ y: 2026, m: 7 })).toBe("July 2026");
    expect(monthLabel({ y: 2025, m: 12 })).toBe("December 2025");
  });
});

/** Test helper, deliberately not exported from the package. */
function addDays(date: { y: number; m: number; d: number }, days: number) {
  const target = toDayNumber(date) + days;
  // Walk forward from a known point. Slow but obviously correct, which is what a test wants.
  let probe = { ...date };
  let guard = 0;
  while (toDayNumber(probe) < target && guard < 20000) {
    const dim = daysInMonth(probe.y, probe.m);
    if (probe.d < dim) {
      probe = { ...probe, d: probe.d + 1 };
    } else if (probe.m < 12) {
      probe = { y: probe.y, m: probe.m + 1, d: 1 };
    } else {
      probe = { y: probe.y + 1, m: 1, d: 1 };
    }
    guard += 1;
  }
  return probe;
}
