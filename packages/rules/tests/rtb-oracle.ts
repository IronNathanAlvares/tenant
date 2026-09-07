/**
 * A reference oracle: the RTB Rent Calculator's algorithm, transcribed.
 *
 * This is NOT part of the engine and must never be imported by `src/`. It exists so the
 * engine can be tested against an independent implementation of the official behaviour,
 * rather than against itself.
 *
 * Two rules govern this file.
 *
 * **It is transcribed, not derived.** Every step follows the description in
 * `docs/measurements/01-rtb-calculator-algorithm.md`, which was read from
 * `https://rtb.ie/wp-content/themes/rtb/assets/rent-calc/Scripts/rent-calc.js`
 * (sha256 1f7a50b86efaba3197232cce6a3d8f86b3f08a651d3a8e6673b6bf83b01432d7, retrieved
 * 6 September 2026). Where the official code is odd, this is odd in the same way. If it
 * were written the way I think it should work, it would not be an oracle.
 *
 * **It uses floats on purpose.** The engine holds money in integer cent because that is
 * correct. The RTB calculator does `Math.round(rent * factor * 100) / 100` on a float euro
 * amount. Reproducing that here is the only way to find out whether the two ever disagree
 * by a cent, which is exactly the question Sprint 2 exists to answer.
 *
 * When the RTB changes their implementation, change this file first. The resulting test
 * failures then say precisely what changed. ADR-0006.
 */

export interface OracleCpiRow {
  readonly month: string;
  readonly value: number;
}

export interface OracleReading {
  readonly value: number;
  readonly year: number;
  readonly month: number;
  readonly usedFallback: boolean;
}

export interface OracleInput {
  /** Euro, as the form takes it, as a float. */
  readonly currentRent: number;
  /** YYYY-MM-DD. */
  readonly lastSetDate: string;
  /** YYYY-MM-DD. */
  readonly newSetDate: string;
  /** The "apartment complex or SSA commenced from 10 June 2025" question. */
  readonly isPost10June2025Development: boolean;
}

export interface OracleResult {
  readonly cpiLast: OracleReading | null;
  readonly cpiNext: OracleReading | null;
  readonly changePct: number | null;
  readonly months: number;
  readonly capPctProRata: number;
  readonly pctApplied: number | null;
  /** The maximum new rent, in euro, as a float. */
  readonly newRent: number | null;
  /** What the calculator actually displays. */
  readonly maxIncrease: number | null;
  readonly capped2pc: boolean;
}

/** Their `CPI_STORE.getCpiForYMonth`: walk back a month at a time until a value exists. */
function getCpiForYMonth(
  rows: readonly OracleCpiRow[],
  y: number,
  m: number,
): OracleReading | null {
  const byMonth = new Map(rows.map((r) => [r.month, r.value]));
  let year = y;
  let month = m;
  // The real implementation bounds this by the table's minimum year. 2000 iterations is
  // more than the table's span and terminates for any input.
  for (let i = 0; i < 2000; i += 1) {
    const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    const value = byMonth.get(key);
    if (value !== undefined) {
      return { value, year, month, usedFallback: !(year === y && month === m) };
    }
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return null;
}

/** Their `fullMonthsBetween`, including the day-of-month decrement. */
function fullMonthsBetween(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  let diff = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) {
    diff -= 1;
  }
  return diff;
}

function ymd(iso: string): { y: number; m: number; d: number } {
  const parts = iso.split("-");
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

/**
 * Run the official calculation.
 *
 * Follows the submit handler in `rent-calc.js` step for step, including flooring a negative
 * CPI change at zero and deriving the displayed increase by subtraction in integer cent
 * after the euro amount has already been rounded.
 */
export function rtbCalculate(input: OracleInput, cpi: readonly OracleCpiRow[]): OracleResult {
  const last = ymd(input.lastSetDate);
  const next = ymd(input.newSetDate);

  const cpiLast = getCpiForYMonth(cpi, last.y, last.m);
  const cpiNext = getCpiForYMonth(cpi, next.y, next.m);

  let changePct: number | null = null;
  if (cpiLast !== null && cpiNext !== null && cpiLast.value !== 0) {
    let pct = ((cpiNext.value - cpiLast.value) / cpiLast.value) * 100;
    if (pct < 0) {
      pct = 0;
    }
    changePct = pct;
  }

  const months = fullMonthsBetween(last, next);
  const monthsClamped = Math.max(0, months);
  const capPctProRata = 2 * (monthsClamped / 12);

  const pctFromCpi = changePct !== null && !Number.isNaN(changePct) ? Math.max(0, changePct) : null;

  let pctApplied: number | null;
  let capped2pc = false;
  if (input.isPost10June2025Development) {
    pctApplied = pctFromCpi;
  } else {
    const base = pctFromCpi !== null ? pctFromCpi : capPctProRata;
    pctApplied = Math.min(base, capPctProRata);
    if (pctFromCpi !== null && pctFromCpi > capPctProRata) {
      capped2pc = true;
    }
  }

  let newRent: number | null = null;
  let maxIncrease: number | null = null;
  if (pctApplied !== null && Number.isFinite(input.currentRent) && input.currentRent >= 0) {
    const factor = 1 + pctApplied / 100;
    newRent = Math.round(input.currentRent * factor * 100) / 100;
    const currentRentCents = Math.round(input.currentRent * 100);
    const newRentCents = Math.round(newRent * 100);
    maxIncrease = Math.max(0, newRentCents - currentRentCents) / 100;
  }

  return {
    cpiLast,
    cpiNext,
    changePct,
    months: monthsClamped,
    capPctProRata,
    pctApplied,
    newRent,
    maxIncrease,
    capped2pc,
  };
}
