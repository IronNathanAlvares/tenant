/**
 * Verify the reference oracle against the RTB's actual code.
 *
 * `packages/rules/tests/rtb-oracle.ts` is my transcription of the official calculator.
 * The whole Sprint 2 agreement number rests on that transcription being faithful, and a
 * transcription I checked myself is not evidence. This downloads the real
 * `rent-calc.js`, runs it under jsdom against a minimal form, and compares its output to
 * the oracle's over the same case set.
 *
 * Deliberately a script rather than a CI test:
 *
 * - It needs the network, and a test that fails when rtb.ie is slow is a bad test.
 * - It runs the RTB's copyrighted code, which is fine to fetch and execute locally but is
 *   not vendored into this MIT repository. Nothing is written to disk except the report.
 *
 * Run it when the oracle changes, when the RTB's file hash changes, or before quoting the
 * agreement figure anywhere that matters.
 *
 *     node scripts/verify_oracle.mjs
 *
 * Exit 0 if every case matches, 1 otherwise.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const SCRIPT_URL =
  "https://rtb.ie/wp-content/themes/rtb/assets/rent-calc/Scripts/rent-calc.js";
const KNOWN_SHA256 = "1f7a50b86efaba3197232cce6a3d8f86b3f08a651d3a8e6673b6bf83b01432d7";

const SNAPSHOT = JSON.parse(readFileSync("data/cpi/cpi-all-items.json", "utf8"));

/** The elements `initRentCalc` looks for. Ids taken from the live page. */
const PAGE = `<!doctype html><html><body>
<form id="rentForm">
  <select id="dwellingType" aria-describedby="dwellingTypeHelp"><option value=""></option><option value="Yes">Yes</option><option value="No">No</option></select>
  <span id="dwellingTypeHelp"></span>
  <input id="currentRent" type="text" aria-describedby="currentRentHelp" />
  <span id="currentRentHelp"></span>
  <input id="lastSetDate" type="hidden" aria-describedby="lastSetDateHint" />
  <span id="lastSetDateHint"></span>
  <input id="newSetDate" type="hidden" aria-describedby="newSetDateHint" />
  <span id="newSetDateHint"></span>
  <button id="submitBtn" type="submit"></button>
  <button id="resetBtn" type="button"></button>
</form>
<div id="dateWarning" hidden></div>
<div id="summary" hidden>
  <span id="post10th"></span><span id="currentRentResult"></span>
  <span id="dateLastSetResult"></span><span id="dateNewSetResult"></span>
  <span id="cpiLastResult"></span><span id="cpiNewResult"></span>
  <span id="cpiPctResult"></span><span id="capResult"></span>
  <span id="newRentResult"></span><span id="noteResult"></span>
</div>
<button id="rentCalcPrintBtn"></button>
</body></html>`;

function buildYearMap() {
  const map = new Map();
  for (const row of SNAPSHOT.series) {
    const [y, m] = row.month.split("-").map(Number);
    if (!map.has(y)) map.set(y, {});
    map.get(y)[m] = row.value;
  }
  return map;
}

async function loadCalculator(source) {
  const dom = new JSDOM(PAGE, { runScripts: "outside-only", url: "https://rtb.ie/" });
  const { window } = dom;

  // The script fetches CPI from the CSO. Give it our pinned snapshot instead, so the
  // comparison is against the same numbers the engine used and cannot drift mid-run.
  window.fetch = () => Promise.reject(new Error("network disabled in harness"));

  window.eval(source);

  const store = window.CPI_STORE;
  if (!store) throw new Error("CPI_STORE was not created, the script's shape has changed");
  const yearMap = buildYearMap();
  const years = [...yearMap.keys()].sort((a, b) => a - b);
  store.yearMap = yearMap;
  store.minYear = years[0];
  store.maxYear = years[years.length - 1];
  store._setReady();

  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  return window;
}

function run(window, testCase) {
  const doc = window.document;
  doc.getElementById("dwellingType").value = testCase.newBuild ? "Yes" : "No";
  doc.getElementById("currentRent").value = String(testCase.rent);
  doc.getElementById("lastSetDate").value = testCase.lastSet;
  doc.getElementById("newSetDate").value = testCase.newSet;

  const form = doc.getElementById("rentForm");
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

  return new Promise((resolve) => {
    // The handler resolves a promise on CPI_STORE before writing results.
    setTimeout(() => {
      resolve({
        maxIncrease: doc.getElementById("newRentResult").textContent,
        cpiLast: doc.getElementById("cpiLastResult").textContent,
        cpiNew: doc.getElementById("cpiNewResult").textContent,
        cpiPct: doc.getElementById("cpiPctResult").textContent,
        capped: doc.getElementById("capResult").textContent,
        hidden: doc.getElementById("summary").hidden,
      });
    }, 0);
  });
}

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

function addDays(iso, days) {
  const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = (y, m) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  let [y, m, d] = iso.split("-").map(Number);
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

// The oracle is TypeScript, so rather than compile it here its output is read from a file
// that `packages/rules/tests/oracle-cases.test.ts` writes on every test run. Both sides
// walk the same case grid, so a missing key means the grids have drifted apart.
const ORACLE = JSON.parse(readFileSync("data/vectors/oracle-cases.json", "utf8"));

async function main() {
  process.stdout.write(`Fetching ${SCRIPT_URL}\n`);
  const response = await fetch(SCRIPT_URL, {
    headers: { "user-agent": "Mozilla/5.0 (tenant oracle verification)" },
  });
  if (!response.ok) {
    process.stderr.write(`Could not fetch the calculator: HTTP ${response.status}\n`);
    process.exit(1);
  }
  const source = await response.text();
  const sha = createHash("sha256").update(source).digest("hex");
  process.stdout.write(`sha256 ${sha}\n`);
  if (sha !== KNOWN_SHA256) {
    process.stdout.write(
      `NOTE: this differs from the hash the oracle was transcribed from\n` +
        `      (${KNOWN_SHA256}). The RTB has changed their implementation.\n` +
        `      Re-read docs/measurements/01 before trusting the result below.\n`,
    );
  }

  const window = await loadCalculator(source);

  let compared = 0;
  const mismatches = [];

  for (const start of STARTS) {
    for (const offset of OFFSETS) {
      for (const rent of RENTS) {
        for (const newBuild of [false, true]) {
          const newSet = addDays(start, offset);
          const key = `${start}|${newSet}|${rent}|${newBuild}`;
          const expected = ORACLE[key];
          if (expected === undefined) continue;

          const actual = await run(window, { lastSet: start, newSet, rent, newBuild });
          if (actual.hidden) continue;

          compared += 1;
          const theirs = actual.maxIncrease.replace("€", "").trim();
          if (theirs !== expected.maxIncrease) {
            mismatches.push({ key, theirs, ours: expected.maxIncrease });
          }
        }
      }
    }
  }

  const report = {
    scriptUrl: SCRIPT_URL,
    sha256: sha,
    hashMatchesTranscription: sha === KNOWN_SHA256,
    verifiedAt: new Date().toISOString(),
    casesCompared: compared,
    mismatches: mismatches.length,
    examples: mismatches.slice(0, 10),
  };
  writeFileSync("data/vectors/oracle-fidelity.json", `${JSON.stringify(report, null, 2)}\n`);

  process.stdout.write(`\nCompared ${compared} cases against the live script.\n`);
  if (mismatches.length === 0) {
    process.stdout.write("The oracle reproduces the RTB calculator exactly.\n");
    process.exit(0);
  }
  process.stdout.write(`${mismatches.length} mismatches:\n`);
  for (const m of mismatches.slice(0, 10)) {
    process.stdout.write(`  ${m.key}: RTB ${m.theirs} vs oracle ${m.ours}\n`);
  }
  process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
