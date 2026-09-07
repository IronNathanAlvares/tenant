import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R-OUT-05. The engine is a pure function.
 *
 * The README claims that rent and address never leave the browser and that a determination
 * is reproducible from its inputs. Both claims rest on this package doing no I/O and
 * reading no clock. A claim like that is worth nothing as a comment, so it is asserted
 * here: the source is scanned and the build fails if anything impure appears.
 *
 * Comments are stripped before scanning, so the file that explains why there is no `Date`
 * is allowed to say the word.
 */

const SRC = join(import.meta.dirname, "..", "src");

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bnew\s+Date\b/, why: "reads the clock and carries a timezone" },
  { pattern: /\bDate\.(now|parse|UTC)\b/, why: "reads the clock" },
  { pattern: /\bMath\.random\b/, why: "not deterministic" },
  { pattern: /\bfetch\s*\(/, why: "network I/O" },
  { pattern: /\bprocess\.(env|argv|cwd)\b/, why: "reads the environment" },
  { pattern: /\brequire\s*\(/, why: "dynamic module loading" },
  { pattern: /\bimport\s*\(/, why: "dynamic module loading" },
  { pattern: /\b(localStorage|sessionStorage|indexedDB)\b/, why: "browser storage" },
  { pattern: /\b(window|document|globalThis)\b/, why: "ambient global state" },
  { pattern: /\bnode:/, why: "a Node built-in, which the browser will not have" },
  { pattern: /\bcrypto\./, why: "not deterministic" },
  { pattern: /\bconsole\./, why: "output side effect" },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

/** Crude but adequate: strips block and line comments so prose does not trip the scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("R-OUT-05, the engine is pure", () => {
  const files = sourceFiles(SRC);

  it("finds the source to scan", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  for (const file of files) {
    const name = file.slice(SRC.length + 1);
    it(`${name} performs no I/O and reads no clock`, () => {
      const code = stripComments(readFileSync(file, "utf8"));
      const found: string[] = [];
      for (const { pattern, why } of FORBIDDEN) {
        if (pattern.test(code)) {
          found.push(`${pattern.source} (${why})`);
        }
      }
      expect(found, `${name} must stay pure but uses: ${found.join(", ")}`).toEqual([]);
    });
  }

  it("imports nothing outside the package", () => {
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier, `${file} imports ${specifier}`).toMatch(/^\.\.?\//);
      }
    }
  });
});
