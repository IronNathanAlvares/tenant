import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rtbCalculate } from "./rtb-oracle";

/**
 * Writes the oracle's answers for a fixed case grid to `data/vectors/oracle-cases.json`.
 *
 * `scripts/verify_oracle.mjs` reads that file, runs the RTB's real `rent-calc.js` under
 * jsdom over the same grid, and reports any case where the transcription and the original
 * disagree. Splitting it this way keeps the network out of the test suite while still
 * letting the two be compared. Task 2.4.
 *
 * The grid here and the grid in the script must stay identical. A key missing on either
 * side is reported rather than silently skipped.
 */

/**
 * The real 357 month snapshot, not the trimmed fixture.
 *
 * This has to be the same data the verification script feeds the RTB's own code, or the
 * comparison measures a difference in inputs rather than a difference in algorithms. The
 * first run of the fidelity check reported 161 mismatches for exactly that reason: the
 * fixture has gaps in 2024 that the real series does not, so the oracle's month walk-back
 * landed somewhere the RTB's never would.
 *
 * Read from disk rather than imported from `@tenant/cpi`, because that package depends on
 * `@tenant/rules` and the reverse edge would be a cycle.
 */
const SNAPSHOT_PATH = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "data",
  "cpi",
  "cpi-all-items.json",
);
const SNAPSHOT = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as {
  series: { month: string; value: number }[];
};
const CPI_ROWS = SNAPSHOT.series.map((r) => ({ month: r.month, value: r.value }));

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
const OFFSETS = [1, 27, 28, 29, 30, 31, 59, 89, 90, 180, 364, 365, 366, 400, 456, 730];
const RENTS = [500, 950.5, 1000, 1234.35, 1750.55, 2000, 9999.99];

function addDays(iso: string, days: number): string {
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = (y: number, m: number) =>
    [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
  const parts = iso.split("-").map(Number);
  let y = parts[0] as number;
  let m = parts[1] as number;
  let d = parts[2] as number;
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
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

describe("oracle case dump for scripts/verify_oracle.mjs", () => {
  it("writes the grid the fidelity check reads", () => {
    const cases: Record<string, { maxIncrease: string; newRent: string; capped: boolean }> = {};

    for (const start of STARTS) {
      for (const offset of OFFSETS) {
        for (const rent of RENTS) {
          for (const newBuild of [false, true]) {
            const newSet = addDays(start, offset);
            const result = rtbCalculate(
              {
                currentRent: rent,
                lastSetDate: start,
                newSetDate: newSet,
                isPost10June2025Development: newBuild,
              },
              CPI_ROWS,
            );
            if (result.newRent === null || result.maxIncrease === null) continue;
            cases[`${start}|${newSet}|${rent}|${newBuild}`] = {
              // Formatted exactly as the page renders it, so the comparison is on strings
              // the RTB itself produced rather than on my rounding of their number.
              maxIncrease: result.maxIncrease.toFixed(2),
              newRent: result.newRent.toFixed(2),
              capped: result.capped2pc,
            };
          }
        }
      }
    }

    const out = join(import.meta.dirname, "..", "..", "..", "data", "vectors");
    writeFileSync(join(out, "oracle-cases.json"), `${JSON.stringify(cases, null, 2)}\n`);

    expect(Object.keys(cases).length).toBeGreaterThan(1000);
  });
});
