/**
 * Plain calendar dates. No `Date`, no timezone, no clock.
 *
 * Rent law is written in calendar dates. A tenancy starts on the 1st of March, not at
 * midnight UTC on the 1st of March. Using JavaScript's `Date` here would mean a
 * determination computed in Dublin and one computed in Los Angeles could differ, which is
 * absurd for a question about Irish rent, and it is the kind of bug that hides for a year
 * and then appears for one user in one timezone. So there is no `Date` in this package.
 *
 * R-DATE-01, R-DATE-02.
 */

/** A calendar date. `m` is 1 to 12, `d` is 1 to 31. */
export interface PlainDate {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

/** A calendar month. `m` is 1 to 12. */
export interface PlainMonth {
  readonly y: number;
  readonly m: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  switch (m) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(y) ? 29 : 28;
    default:
      throw new RangeError(`Not a month: ${m}`);
  }
}

/**
 * Parse `YYYY-MM-DD`. Rejects rather than coerces: `2026-02-30` is an error, not
 * the 2nd of March. R-DATE-04.
 */
export function parseDate(input: string): PlainDate {
  const match = DATE_PATTERN.exec(input.trim());
  if (!match) {
    throw new SyntaxError(`Not a YYYY-MM-DD date: ${JSON.stringify(input)}`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) {
    throw new RangeError(`Month out of range in ${input}`);
  }
  if (d < 1 || d > daysInMonth(y, m)) {
    throw new RangeError(`Day out of range in ${input}`);
  }
  return { y, m, d };
}

export function parseMonth(input: string): PlainMonth {
  const match = MONTH_PATTERN.exec(input.trim());
  if (!match) {
    throw new SyntaxError(`Not a YYYY-MM month: ${JSON.stringify(input)}`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) {
    throw new RangeError(`Month out of range in ${input}`);
  }
  return { y, m };
}

export function formatDate(date: PlainDate): string {
  return `${String(date.y).padStart(4, "0")}-${String(date.m).padStart(2, "0")}-${String(
    date.d,
  ).padStart(2, "0")}`;
}

export function formatMonth(month: PlainMonth): string {
  return `${String(month.y).padStart(4, "0")}-${String(month.m).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "June 2025", for the audit trail and the interface. */
export function monthLabel(month: PlainMonth): string {
  const name = MONTH_NAMES[month.m - 1];
  if (name === undefined) {
    throw new RangeError(`Not a month: ${month.m}`);
  }
  return `${name} ${month.y}`;
}

/** Negative if a is before b, zero if equal, positive if after. */
export function compareDates(a: PlainDate, b: PlainDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

export function compareMonths(a: PlainMonth, b: PlainMonth): number {
  return a.y - b.y || a.m - b.m;
}

export function monthOf(date: PlainDate): PlainMonth {
  return { y: date.y, m: date.m };
}

export function addMonths(month: PlainMonth, delta: number): PlainMonth {
  const total = month.y * 12 + (month.m - 1) + delta;
  return { y: Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 };
}

export function previousMonth(month: PlainMonth): PlainMonth {
  return addMonths(month, -1);
}

/**
 * Whole months elapsed, using the RTB calculator's rule:
 *
 *     diff = (b.y - a.y) * 12 + (b.m - a.m)
 *     if (b.d < a.d) diff -= 1
 *
 * Reproduced deliberately rather than derived, because the official tool's answer is the
 * one a landlord's notice will carry. R-DATE-03, ADR-0006.
 */
export function wholeMonthsBetween(a: PlainDate, b: PlainDate): number {
  const months = (b.y - a.y) * 12 + (b.m - a.m);
  return b.d < a.d ? months - 1 : months;
}

/** Days since 1970-01-01, for measuring intervals. Not a timestamp. */
export function toDayNumber(date: PlainDate): number {
  // Howard Hinnant's days_from_civil, which is exact for all civil dates.
  const y = date.m <= 2 ? date.y - 1 : date.y;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (date.m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + date.d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function daysBetween(a: PlainDate, b: PlainDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/**
 * Add whole years, clamping 29 February to 28 February in a non-leap year. Used to find
 * the anniversary of a rent setting.
 */
export function addYears(date: PlainDate, years: number): PlainDate {
  const y = date.y + years;
  const d = Math.min(date.d, daysInMonth(y, date.m));
  return { y, m: date.m, d };
}

/**
 * Split the interval between two dates into whole elapsed years and the remaining days,
 * along with the length of the year that remainder sits in.
 *
 * Section 19(4)(b) gives 2 per cent "in respect of each year that has elapsed" plus, for
 * the remaining shorter period, "such percentage as bears to 2 per cent the same
 * proportion that that period bears to a year". That wording needs a whole-year count and
 * a fraction of the year that follows, which is what this returns.
 */
export function yearsAndRemainder(
  from: PlainDate,
  to: PlainDate,
): { years: number; remainderDays: number; daysInRemainderYear: number } {
  if (compareDates(to, from) < 0) {
    throw new RangeError("`to` is before `from`");
  }
  let years = 0;
  while (compareDates(addYears(from, years + 1), to) <= 0) {
    years += 1;
  }
  const anniversary = addYears(from, years);
  const nextAnniversary = addYears(from, years + 1);
  return {
    years,
    remainderDays: daysBetween(anniversary, to),
    daysInRemainderYear: daysBetween(anniversary, nextAnniversary),
  };
}
