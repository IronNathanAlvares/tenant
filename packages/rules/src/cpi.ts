/**
 * CPI lookup.
 *
 * The snapshot is injected, never fetched. The engine does no I/O. R-CPI-01, ADR-0003.
 *
 * There are two ways to pick which months to compare, and they disagree. The RTB's own
 * calculator uses the month *of* each date. Section 19(4)(b) uses the month *before* the
 * new setting, and defines the previous month asymmetrically across 1 March 2026. Both are
 * implemented here, deliberately, because the determination reports both. ADR-0006.
 */

import {
  compareDates,
  formatMonth,
  monthOf,
  type PlainDate,
  type PlainMonth,
  parseDate,
  previousMonth,
} from "./dates";

/** The date the national rent control rules took effect. */
export const NATIONAL_RENT_CONTROL_START: PlainDate = parseDate("2026-03-01");

/** Building control commencement notices on or after this date may exempt a dwelling. */
export const NEW_BUILD_EXEMPTION_START: PlainDate = parseDate("2025-06-10");

/**
 * Commencement of section 3 of the Residential Tenancies (Amendment) Act 2021, which is the
 * pivot for the HICP version of the same asymmetry. The Act was signed on 11 December 2021
 * and section 3 took effect from that date.
 */
export const HICP_REGIME_START: PlainDate = parseDate("2021-12-11");

/**
 * From this date the Residential Tenancies (Amendment) Act 2025 deemed every area of the
 * State that was not already a rent pressure zone to be one. Before it, the pre-2026 cap
 * only applied inside a designated zone, so geography mattered and we have to ask.
 */
export const WHOLE_STATE_DEEMED_RPZ: PlainDate = parseDate("2025-06-20");

export interface CpiSnapshot {
  /** Content hash over the series, recorded on every determination. R-CPI-06. */
  readonly sha256: string;
  /** e.g. "December 2023 = 100". */
  readonly base: string;
  readonly latestMonth: string;
  readonly series: readonly { readonly month: string; readonly value: number }[];
}

export interface CpiReading {
  /** The month actually used, which may not be the month asked for. */
  readonly month: PlainMonth;
  readonly value: number;
  /** The month originally asked for. */
  readonly requested: PlainMonth;
  /** True when the requested month had no published value and we walked back. R-CPI-02. */
  readonly usedFallback: boolean;
}

export type CpiBasis = "rtb" | "statute";

/**
 * Look up a month, walking back one month at a time until a published value is found.
 *
 * This is how both the statute and the RTB handle publication lag. The statute says the
 * current CPI number falls back to "the month immediately preceding that month" when the
 * first choice is not published; the RTB's implementation walks back without a limit. We
 * walk back without a limit and report the distance, which is a superset of both, and let
 * the caller decide whether the gap is acceptable.
 *
 * Returns `null` when the snapshot has no value at or before the requested month.
 */
export function lookupCpi(snapshot: CpiSnapshot, requested: PlainMonth): CpiReading | null {
  const wanted = formatMonth(requested);
  let best: { month: string; value: number } | null = null;

  for (const row of snapshot.series) {
    if (row.month <= wanted && (best === null || row.month > best.month)) {
      best = { month: row.month, value: row.value };
    }
  }

  if (best === null) {
    return null;
  }

  const parts = best.month.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  return {
    month: { y, m },
    value: best.value,
    requested,
    usedFallback: best.month !== wanted,
  };
}

/**
 * The CPI number for the new setting.
 *
 * RTB basis: the month of the setting. Statutory basis: the month immediately preceding
 * it. R-CPI-03, R-CPI-04.
 */
export function currentCpiNumber(
  snapshot: CpiSnapshot,
  newSetting: PlainDate,
  basis: CpiBasis,
): CpiReading | null {
  const target = basis === "rtb" ? monthOf(newSetting) : previousMonth(monthOf(newSetting));
  return lookupCpi(snapshot, target);
}

/**
 * The CPI number for the previous setting.
 *
 * RTB basis: the month of the previous setting, always.
 *
 * Statutory basis, and this is the asymmetry nothing else implements: the month *of* the
 * previous setting where that setting took place before 1 March 2026, and the month
 * *immediately preceding* it where it took place on or after. Section 19(4)(b), definition
 * of "previous CPI number". R-CPI-05.
 */
export function previousCpiNumber(
  snapshot: CpiSnapshot,
  previousSetting: PlainDate,
  basis: CpiBasis,
): CpiReading | null {
  return previousIndexNumber(snapshot, previousSetting, basis, NATIONAL_RENT_CONTROL_START);
}

/**
 * The same asymmetry, one regime earlier.
 *
 * Section 19(4)(b) as inserted by section 3 of the Residential Tenancies (Amendment) Act 2021
 * defined "previous HICP value" in exactly the shape the CPI definition now has, pivoting on
 * that section's own commencement instead of on 1 March 2026. Same rule, different date, so
 * it is the same function with a different pivot rather than a second implementation.
 */
export function previousHicpNumber(
  snapshot: CpiSnapshot,
  previousSetting: PlainDate,
  basis: CpiBasis,
): CpiReading | null {
  return previousIndexNumber(snapshot, previousSetting, basis, HICP_REGIME_START);
}

/**
 * The general form. Before the pivot, take the month the previous setting happened in.
 * On or after it, take the month before.
 */
export function previousIndexNumber(
  snapshot: CpiSnapshot,
  previousSetting: PlainDate,
  basis: CpiBasis,
  pivot: PlainDate,
): CpiReading | null {
  if (basis === "rtb") {
    return lookupCpi(snapshot, monthOf(previousSetting));
  }
  const beforePivot = compareDates(previousSetting, pivot) < 0;
  const target = beforePivot ? monthOf(previousSetting) : previousMonth(monthOf(previousSetting));
  return lookupCpi(snapshot, target);
}

/**
 * The percentage change between two CPI readings, floored at zero.
 *
 * Deflation does not entitle anyone to a rent reduction, and the statute frames constraint
 * B as a ceiling on an increase rather than a two-way peg. The RTB's calculator floors it
 * at zero for the same reason. R-CPI-07.
 */
export function cpiChangePercent(previous: CpiReading, current: CpiReading): number {
  if (previous.value === 0) {
    return 0;
  }
  const change = ((current.value - previous.value) / previous.value) * 100;
  return change < 0 ? 0 : change;
}
