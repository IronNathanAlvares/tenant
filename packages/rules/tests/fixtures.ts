import type { CpiSnapshot } from "../src/cpi";

/**
 * Real All Items CPI values, CSO table CPM24, statistic CPM24C01, sub index CP00,
 * base December 2023 = 100. Cross-checked against the table the RTB renders on its own
 * calculator page, which matched exactly.
 *
 * Trimmed to the range the tests need. The full 357 month snapshot lives in
 * data/cpi/cpi-all-items.json.
 */
export const CPI: CpiSnapshot = {
  sha256: "test-fixture-not-the-real-snapshot",
  base: "December 2023 = 100",
  latestMonth: "2026-07",
  series: [
    { month: "2024-01", value: 98.7 },
    { month: "2024-06", value: 101.3 },
    { month: "2024-12", value: 101.4 },
    { month: "2025-01", value: 100.6 },
    { month: "2025-02", value: 101.5 },
    { month: "2025-03", value: 102.2 },
    { month: "2025-04", value: 102.6 },
    { month: "2025-05", value: 102.6 },
    { month: "2025-06", value: 103.1 },
    { month: "2025-07", value: 103.2 },
    { month: "2025-08", value: 103.6 },
    { month: "2025-09", value: 103.4 },
    { month: "2025-10", value: 103.9 },
    { month: "2025-11", value: 103.7 },
    { month: "2025-12", value: 104.2 },
    { month: "2026-01", value: 103.3 },
    { month: "2026-02", value: 104.2 },
    { month: "2026-03", value: 105.9 },
    { month: "2026-04", value: 106.4 },
    { month: "2026-05", value: 106.3 },
    { month: "2026-06", value: 106.6 },
    { month: "2026-07", value: 106.7 },
  ],
};
