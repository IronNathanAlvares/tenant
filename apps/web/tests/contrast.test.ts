import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Colour contrast, measured from the design tokens.
 *
 * axe cannot check this in jsdom, because jsdom does no layout and does not resolve CSS
 * custom properties. Rather than declare contrast untestable and check it by eye once,
 * the tokens are parsed out of `globals.css` and every pair the interface actually uses is
 * checked against WCAG 2.2.
 *
 * This catches the realistic failure: someone nudges a colour to look better in dark mode
 * and quietly drops a state below the threshold. On this site the states carry meaning,
 * lawful against unlawful, so that is not cosmetic.
 *
 * Thresholds: 4.5:1 for body text, 3:1 for large text and for the borders and boundaries
 * that carry meaning. WCAG 2.2 SC 1.4.3 and 1.4.11.
 */

const CSS = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");

/** Pull the custom properties out of a block, given the selector that opens it. */
function tokensAfter(marker: string): Record<string, string> {
  const start = CSS.indexOf(marker);
  if (start === -1) throw new Error(`could not find ${marker} in globals.css`);
  const open = CSS.indexOf("{", start);
  const end = CSS.indexOf("}", open);
  const block = CSS.slice(open, end);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) tokens[name] = value;
  }
  return tokens;
}

const LIGHT = tokensAfter(":root {");
// The dark block redefines a subset, so it inherits everything it does not override.
const DARK = { ...LIGHT, ...tokensAfter("@media (prefers-color-scheme: dark)") };

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Every pair the interface actually renders, with what it is used for. */
const PAIRS: { fg: string; bg: string; use: string; min: number }[] = [
  { fg: "--text", bg: "--bg", use: "body text", min: 4.5 },
  { fg: "--text", bg: "--surface", use: "text on a card", min: 4.5 },
  { fg: "--text", bg: "--surface-sunk", use: "text on a sunk panel", min: 4.5 },
  { fg: "--muted", bg: "--bg", use: "hints and secondary text", min: 4.5 },
  { fg: "--muted", bg: "--surface", use: "audit detail on a card", min: 4.5 },
  { fg: "--muted", bg: "--surface-sunk", use: "small print in the next steps", min: 4.5 },
  { fg: "--accent", bg: "--bg", use: "links and the disclosure toggle", min: 4.5 },
  { fg: "--accent", bg: "--surface", use: "citation links on a card", min: 4.5 },
  { fg: "--ok", bg: "--ok-soft", use: "the lawful verdict", min: 4.5 },
  { fg: "--bad", bg: "--bad-soft", use: "the unlawful verdict and the deadline", min: 4.5 },
  { fg: "--warn", bg: "--warn-soft", use: "the uncertain verdict", min: 4.5 },
  { fg: "--text", bg: "--accent-soft", use: "the boundary statement", min: 4.5 },
  { fg: "--text", bg: "--ok-soft", use: "body copy inside a lawful verdict", min: 4.5 },
  { fg: "--text", bg: "--bad-soft", use: "body copy inside an unlawful verdict", min: 4.5 },
  { fg: "--text", bg: "--warn-soft", use: "body copy inside an uncertain verdict", min: 4.5 },
  { fg: "--bg", bg: "--accent", use: "the print button label", min: 4.5 },
  // Non-text, so 3:1 under SC 1.4.11. These carry state, so they are not decoration.
  { fg: "--rule-strong", bg: "--surface", use: "input borders", min: 3 },
  { fg: "--accent", bg: "--bg", use: "the focus ring", min: 3 },
];

for (const [theme, tokens] of [
  ["light", LIGHT],
  ["dark", DARK],
] as const) {
  describe(`contrast, ${theme} theme`, () => {
    for (const pair of PAIRS) {
      it(`${pair.use} meets ${pair.min}:1`, () => {
        const fg = tokens[pair.fg];
        const bg = tokens[pair.bg];
        expect(fg, `${pair.fg} is not defined in the ${theme} theme`).toBeDefined();
        expect(bg, `${pair.bg} is not defined in the ${theme} theme`).toBeDefined();
        if (fg === undefined || bg === undefined) return;

        const ratio = contrast(fg, bg);
        expect(
          ratio,
          `${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1 (${pair.use})`,
        ).toBeGreaterThanOrEqual(pair.min);
      });
    }
  });
}

describe("the contrast maths itself", () => {
  it("agrees with the known extremes", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrast("#1f5c3d", "#fdfcfa")).toBeCloseTo(contrast("#fdfcfa", "#1f5c3d"), 10);
  });
});

describe("meaning never depends on colour alone", () => {
  it("every verdict tone also carries a text label", () => {
    // WCAG SC 1.4.1. The result classes .ok, .bad and .warn set a colour, and the
    // component always renders a .verdict-label beside them. Asserted in the page tests;
    // here we only check the stylesheet has not started hiding that label.
    expect(CSS).toMatch(/\.verdict-label\s*\{/);
    expect(CSS).not.toMatch(/\.verdict-label\s*\{[^}]*display:\s*none/);
  });
});
