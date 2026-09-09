import { describe, expect, it } from "vitest";
import { parseDate } from "../src/dates";
import { evaluateRent } from "../src/evaluate";
import { parseEuro } from "../src/money";
import { assessNotice, type DisputeDeadline } from "../src/notice";
import {
  buildPack,
  deadlineSentence,
  landlordLetter,
  summariseNotice,
  summariseRent,
} from "../src/pack";
import type { RentQuery } from "../src/types";
import { CPI } from "./fixtures";

/**
 * The dispute pack.
 *
 * The interesting assertions here are not that strings exist. They are that the prose stays
 * readable (5.7, measured rather than claimed), that it never predicts an outcome
 * (R-SAFE-04), and that the letter stays calm enough to send to someone you still have to
 * live under.
 */

const TODAY = parseDate("2026-06-15");

function rentQuery(overrides: Partial<RentQuery> = {}): RentQuery {
  return {
    tenancyKind: "private",
    previousSetting: parseDate("2025-06-01"),
    previousRent: parseEuro("2000"),
    newSetting: parseDate("2026-09-01"),
    newBuildExemption: "no",
    asOf: parseDate("2026-09-01"),
    ...overrides,
  };
}

const overTheLimit = evaluateRent(rentQuery({ proposedRent: parseEuro("2200") }), CPI);
const withinTheLimit = evaluateRent(rentQuery({ proposedRent: parseEuro("2040") }), CPI);

const lateToBoard = assessNotice({
  servedOnTenant: parseDate("2026-06-01"),
  servedOnBoard: parseDate("2026-06-04"),
  newRentEffectiveFrom: parseDate("2026-09-01"),
  asOf: TODAY,
});

/**
 * Flesch-Kincaid grade level.
 *
 * A rough measure, and it is only used as a ceiling. The point is to catch prose drifting
 * into legal register, not to chase a number.
 */
/**
 * Strip the bits that are not prose.
 *
 * The letter contains a bulleted working, and bullets have no full stops, so a naive
 * sentence splitter reads the whole list as one 48 word sentence and fails a check it
 * should not be applying. A list of figures is not prose and is not what the readability
 * ceiling is for.
 */
function proseOnly(text: string): string {
  // Drop bullet lines. A list of figures is not prose.
  return text.replace(/^\s*-.*$/gm, " ");
}

function fleschKincaidGrade(text: string): number {
  // Replace amounts and figures with a one-syllable word, WITHOUT eating the full stops
  // that mark sentence ends. An earlier version put "." in the character class, which
  // collapsed everything into one sentence and scored grade 51.
  const clean = text.replace(/€?\d[\d,]*(?:\.\d+)?%?/g, "ten");
  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const words = clean.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  if (sentences === 0 || words.length === 0) return 0;
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return groups === null ? 1 : groups.length;
}

describe("summariseRent", () => {
  it("leads with the answer, not the reasoning", () => {
    const summary = summariseRent(overTheLimit);
    expect(summary.headline).toBe("The rent you are being asked for is above the legal limit.");
  });

  it("says the opposite thing when the rent is lawful", () => {
    const summary = summariseRent(withinTheLimit);
    expect(summary.headline).toContain("within the legal limit");
    // And immediately points at the other question, because a lawful amount asked for
    // badly still does not take effect.
    expect(summary.nextSteps.join(" ")).toMatch(/notice itself is a separate question/i);
  });

  it("carries both figures when the two readings of the Act disagree", () => {
    const summary = summariseRent(overTheLimit);
    expect(summary.points.join(" ")).toContain("€2,050.08");
    expect(summary.points.join(" ")).toContain("differ by €0.08 a month");
    expect(summary.points.join(" ")).toContain("RTB's own rent calculator");
  });

  it("explains which of the two caps bound, in words rather than jargon", () => {
    const summary = summariseRent(overTheLimit);
    expect(summary.points.join(" ")).toMatch(/two limits apply and the lower one wins/i);
  });

  it("handles every outcome without throwing", () => {
    const cases = [
      evaluateRent(rentQuery({ tenancyKind: "cost-rental" }), CPI),
      evaluateRent(rentQuery({ newBuildExemption: "unknown" }), CPI),
      evaluateRent(rentQuery({ noticeServed: parseDate("2026-02-01") }), CPI),
      evaluateRent(rentQuery({ marketRentPathApplies: true }), CPI),
    ];
    for (const determination of cases) {
      const summary = summariseRent(determination);
      expect(summary.headline.length).toBeGreaterThan(10);
      expect(summary.nextSteps.length).toBeGreaterThan(0);
    }
  });
});

describe("summariseNotice", () => {
  it("says plainly that the increase did not take effect", () => {
    const summary = summariseNotice(lateToBoard);
    expect(summary.headline).toMatch(/did not take effect/i);
    expect(summary.points.join(" ")).toMatch(/3 days after/);
  });

  it("counts the gaps rather than hiding them", () => {
    const summary = summariseNotice(lateToBoard);
    expect(summary.points.join(" ")).toMatch(/were not checked, because you did not answer/i);
    expect(summary.points.join(" ")).toMatch(/not problems, they are gaps/i);
  });

  it("puts the deadline in the next steps, first", () => {
    const summary = summariseNotice(lateToBoard);
    expect(summary.nextSteps[0]).toMatch(/refer a dispute to the RTB/i);
  });
});

/** `disputeDeadline` is never null for a well-formed notice, but assert it rather than assume. */
function deadlineOf(assessment: { disputeDeadline: DisputeDeadline | null }): DisputeDeadline {
  const deadline = assessment.disputeDeadline;
  if (deadline === null) throw new Error("expected a deadline");
  return deadline;
}

describe("the deadline sentence", () => {
  it("counts down", () => {
    expect(deadlineSentence(deadlineOf(lateToBoard))).toMatch(
      /You have until 1 September 2026 .* 78 days away/,
    );
  });

  it("does not tell someone it is hopeless once it has passed", () => {
    const past = assessNotice({
      servedOnTenant: parseDate("2025-01-01"),
      newRentEffectiveFrom: parseDate("2025-06-01"),
      asOf: TODAY,
    });
    const sentence = deadlineSentence(deadlineOf(past));
    expect(sentence).toMatch(/has passed/);
    expect(sentence).toMatch(/before assuming it is too late/);
  });
});

describe("the letter to the landlord", () => {
  const letter = landlordLetter(overTheLimit, lateToBoard, {
    today: TODAY,
    tenantName: "Aoife Ryan",
    landlordName: "Mr Byrne",
    propertyAddress: "12 Rathmines Road, Dublin 6",
  });

  it("is addressed and dated properly", () => {
    expect(letter).toContain("15 June 2026");
    expect(letter).toContain("Dear Mr Byrne,");
    expect(letter).toContain("Re: the rent review notice for 12 Rathmines Road, Dublin 6");
    expect(letter.trimEnd().endsWith("Aoife Ryan")).toBe(true);
  });

  it("works with nothing filled in, leaving obvious blanks", () => {
    const blank = landlordLetter(overTheLimit, lateToBoard, { today: TODAY });
    expect(blank).toContain("Dear landlord,");
    expect(blank).toContain("[your name]");
    expect(blank).toContain("for my home");
  });

  it("states the position and cites the provision", () => {
    expect(letter).toContain("section 22 of the Residential Tenancies Act 2004");
    expect(letter).toContain("does not take effect");
    expect(letter).toContain("€2,050.00");
  });

  it("shows the working, so the landlord can check it", () => {
    expect(letter).toContain("My working:");
    expect(letter).toContain("Maximum lawful rent: 2050.00");
  });

  it("asks for a reply by the deadline, and explains why that date", () => {
    expect(letter).toMatch(/reply before 1 September 2026/);
    expect(letter).toMatch(/refer the matter to the RTB/);
  });

  it("R-SAFE-04: never predicts what an adjudicator would decide", () => {
    const forbidden = [
      /you will win/i,
      /you would win/i,
      /the RTB will (find|decide|rule|order)/i,
      /is illegal/i,
      /must (refund|repay)/i,
    ];
    for (const pattern of forbidden) {
      expect(letter, `letter should not match ${pattern}`).not.toMatch(pattern);
    }
  });

  it("stays calm, and does not lead with the criminal offence", () => {
    // Section 22(4) makes a defective notice an offence. True, and in the pack. Putting it
    // in a first letter turns a fixable disagreement into a fight with someone who controls
    // where you live.
    expect(letter).not.toMatch(/offence|criminal|prosecut/i);
    expect(letter).toMatch(/rather sort it out directly/i);
  });
});

describe("buildPack", () => {
  const pack = buildPack(overTheLimit, lateToBoard, { today: TODAY });

  it("assembles both halves", () => {
    expect(pack.rent).not.toBeNull();
    expect(pack.notice).not.toBeNull();
    expect(pack.letter.length).toBeGreaterThan(200);
  });

  it("records what produced it, so a figure can be reproduced later", () => {
    expect(pack.provenance).toContain("Rules version 1.0.0");
    expect(pack.provenance).toContain("CPI data to 2026-07");
    expect(pack.provenance).toContain("in your browser");
  });

  it("collects citations from both halves without duplicating them", () => {
    const keys = pack.citations.map((c) => `${c.act}|${c.provision}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((k) => k.includes("s. 19(4)"))).toBe(true);
    expect(keys.some((k) => k.includes("s. 22"))).toBe(true);
  });

  it("copes with only half the information", () => {
    expect(buildPack(overTheLimit, null, { today: TODAY }).notice).toBeNull();
    expect(buildPack(null, lateToBoard, { today: TODAY }).rent).toBeNull();
    expect(buildPack(null, null, { today: TODAY }).letter).toBe("");
  });

  it("writes a letter from a notice alone, which is often the stronger ground", () => {
    const noticeOnly = buildPack(null, lateToBoard, { today: TODAY });
    expect(noticeOnly.letter).toContain("Dear landlord,");
    expect(noticeOnly.letter).toContain("section 22 of the Residential Tenancies Act 2004");
    // With no rent determination there is no figure to quote, and it must not invent one.
    expect(noticeOnly.letter).not.toContain("maximum lawful rent");
    expect(noticeOnly.letter).not.toContain("My working:");
  });
});

describe("5.7, readability, measured rather than claimed", () => {
  const texts: { name: string; text: string }[] = [
    { name: "rent summary", text: sentences(summariseRent(overTheLimit)) },
    { name: "lawful rent summary", text: sentences(summariseRent(withinTheLimit)) },
    { name: "notice summary", text: sentences(summariseNotice(lateToBoard)) },
    {
      name: "letter",
      text: landlordLetter(overTheLimit, lateToBoard, { today: TODAY }),
    },
  ];

  for (const { name, text } of texts) {
    it(`${name} reads below a grade 10 level`, () => {
      const grade = fleschKincaidGrade(proseOnly(text));
      expect(grade, `${name} scored ${grade.toFixed(1)}`).toBeLessThan(10);
    });
  }

  it("keeps sentences short", () => {
    for (const { name, text } of texts) {
      const longest = proseOnly(text)
        .split(/[.!?]\s/)
        .map((s) => s.split(/\s+/).length)
        .reduce((a, b) => Math.max(a, b), 0);
      expect(longest, `${name} has a ${longest} word sentence`).toBeLessThan(45);
    }
  });
});

function sentences(summary: {
  headline: string;
  points: readonly string[];
  nextSteps: readonly string[];
}) {
  return [summary.headline, ...summary.points, ...summary.nextSteps].join(" ");
}
