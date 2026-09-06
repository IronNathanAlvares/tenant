import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cents, formatEuro, formatEuroDisplay, parseEuro } from "../src/money";

describe("parseEuro", () => {
  it("parses the shapes a person actually types", () => {
    expect(parseEuro("1550")).toBe(155_000);
    expect(parseEuro("1550.50")).toBe(155_050);
    expect(parseEuro("1550.5")).toBe(155_050);
    expect(parseEuro("1,550.50")).toBe(155_050);
    expect(parseEuro("€1550.50")).toBe(155_050);
    expect(parseEuro("  1550.50  ")).toBe(155_050);
  });

  it("does not lose a cent to binary floating point", () => {
    // 1234.35 * 100 is 123434.99999999999 in IEEE 754.
    expect(parseEuro("1234.35")).toBe(123_435);
    expect(parseEuro("0.29")).toBe(29);
    expect(parseEuro("8.20")).toBe(820);
  });

  it("rejects rather than silently rounding a third decimal place", () => {
    expect(() => parseEuro("1550.505")).toThrow(SyntaxError);
  });

  it("rejects junk", () => {
    for (const bad of ["", "   ", "abc", "15.5.5", "1 550", "--5"]) {
      expect(() => parseEuro(bad)).toThrow();
    }
  });
});

describe("formatEuro", () => {
  it("always shows two decimal places", () => {
    expect(formatEuro(cents(155_000))).toBe("1550.00");
    expect(formatEuro(cents(155_005))).toBe("1550.05");
    expect(formatEuro(cents(5))).toBe("0.05");
    expect(formatEuro(cents(0))).toBe("0.00");
  });

  it("groups thousands for display", () => {
    expect(formatEuroDisplay(cents(155_000))).toBe("€1,550.00");
    expect(formatEuroDisplay(cents(100_000_000))).toBe("€1,000,000.00");
    expect(formatEuroDisplay(cents(50_00))).toBe("€50.00");
  });
});

describe("cents", () => {
  it("refuses a fractional amount", () => {
    expect(() => cents(10.5)).toThrow(RangeError);
  });
});

describe("round trip", () => {
  it("parse then format is the identity on any amount up to a million euro", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), (minor) => {
        const text = formatEuro(cents(minor));
        return parseEuro(text) === minor;
      }),
      { numRuns: 2000 },
    );
  });
});
