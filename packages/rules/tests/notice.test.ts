import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatDate, parseDate } from "../src/dates";
import {
  type Answer,
  assessNotice,
  disputeDeadline,
  type NoticeContents,
  type NoticeQuery,
  severityRank,
} from "../src/notice";

/**
 * Section 22 notice validity. R-NOT-01 to R-NOT-06.
 *
 * The scenario at the centre of these tests is the one the product exists for: a notice
 * that is perfectly within the rent cap and still worth nothing because the landlord
 * posted the RTB copy instead of uploading it.
 */

/** A notice that complies with everything, so each test can break exactly one thing. */
function goodContents(): NoticeContents {
  return {
    prescribedForm: "yes",
    statesNewRent: "yes",
    statesEffectiveDate: "yes",
    statesDisputeDeadline: "yes",
    marketRentStatement: "yes",
    threeComparables: "yes",
    comparablesHaveRtNumbers: "yes",
    statesFloorArea: "yes",
    statesBer: "yes",
    statesSignatureDate: "yes",
    showsCalculation: "yes",
    signed: "yes",
  };
}

function notice(overrides: Partial<NoticeQuery> = {}): NoticeQuery {
  return {
    servedOnTenant: parseDate("2026-06-01"),
    servedOnBoard: parseDate("2026-06-01"),
    newRentEffectiveFrom: parseDate("2026-09-01"),
    previousSetting: parseDate("2025-05-01"),
    tenancyStart: parseDate("2026-03-15"),
    contents: goodContents(),
    asOf: parseDate("2026-06-10"),
    ...overrides,
  };
}

describe("a fully compliant notice", () => {
  const result = assessNotice(notice());

  it("finds no defects", () => {
    expect(result.defects).toEqual([]);
  });

  it("leaves nothing unassessed when every question is answered", () => {
    expect(result.notAssessed).toEqual([]);
  });

  it("concludes the rent takes effect", () => {
    expect(result.rentTakesEffect).toBe(true);
  });
});

describe("R-NOT-02, the same-day RTB rule", () => {
  it("catches a notice posted to the RTB a day late", () => {
    const result = assessNotice(notice({ servedOnBoard: parseDate("2026-06-03") }));
    const defect = result.defects.find((d) => d.id === "board-same-day");
    expect(defect?.severity).toBe("rent-has-no-effect");
    expect(defect?.finding).toContain("2 days after");
    expect(result.rentTakesEffect).toBe(false);
  });

  it("catches a notice never sent to the RTB at all", () => {
    const result = assessNotice(notice({ servedOnBoard: "not-served" }));
    expect(result.defects.some((d) => d.id === "board-same-day")).toBe(true);
    expect(result.rentTakesEffect).toBe(false);
  });

  it("does not apply the rule to a notice served before 1 March 2026", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-02-25"),
        servedOnBoard: "not-served",
        newRentEffectiveFrom: parseDate("2026-06-25"),
        asOf: parseDate("2026-03-01"),
      }),
    );
    // Applying a rule that did not exist yet would invent a defect.
    expect(result.defects.some((d) => d.id === "board-same-day")).toBe(false);
    const skipped = result.notAssessed.find((n) => n.id === "board-same-day");
    expect(skipped?.whyItMatters).toContain("1 March 2026");
  });

  it("applies from 1 March 2026 exactly", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-03-01"),
        servedOnBoard: "not-served",
        newRentEffectiveFrom: parseDate("2026-07-01"),
        asOf: parseDate("2026-03-05"),
      }),
    );
    expect(result.defects.some((d) => d.id === "board-same-day")).toBe(true);
  });

  it("asks the question rather than assuming, when the answer is unknown", () => {
    const result = assessNotice(notice({ servedOnBoard: "unknown" }));
    expect(result.defects.some((d) => d.id === "board-same-day")).toBe(false);
    const asked = result.notAssessed.find((n) => n.id === "board-same-day");
    expect(asked?.whyItMatters).toContain("posted");
    expect(result.rentTakesEffect).toBe("unclear");
  });
});

describe("R-NOT-01, the 90 day notice period", () => {
  it("accepts exactly 90 days", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-06-01"),
        servedOnBoard: parseDate("2026-06-01"),
        newRentEffectiveFrom: parseDate("2026-08-30"),
      }),
    );
    expect(result.defects.some((d) => d.id === "notice-period")).toBe(false);
  });

  it("rejects 89 days and says how short it is", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-06-01"),
        servedOnBoard: parseDate("2026-06-01"),
        newRentEffectiveFrom: parseDate("2026-08-29"),
      }),
    );
    const defect = result.defects.find((d) => d.id === "notice-period");
    expect(defect?.finding).toContain("89 days");
    expect(defect?.finding).toContain("1 short");
    expect(defect?.severity).toBe("rent-has-no-effect");
  });

  it("handles a notice dated after the rent changed without producing nonsense", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-09-01"),
        servedOnBoard: parseDate("2026-09-01"),
        newRentEffectiveFrom: parseDate("2026-06-01"),
      }),
    );
    const defect = result.defects.find((d) => d.id === "notice-period");
    expect(defect?.finding).toContain("Check the dates");
  });
});

describe("R-NOT-03, review frequency and the contested 24 month point", () => {
  it("flags a review less than 12 months after the last one", () => {
    const result = assessNotice(
      notice({
        previousSetting: parseDate("2026-01-01"),
        servedOnTenant: parseDate("2026-06-01"),
      }),
    );
    const defect = result.defects.find((d) => d.id === "review-frequency");
    expect(defect?.severity).toBe("review-not-permitted");
  });

  it("accepts a review more than 12 months later on a new tenancy", () => {
    const result = assessNotice(
      notice({ tenancyStart: parseDate("2026-03-15"), previousSetting: parseDate("2025-05-01") }),
    );
    expect(result.defects.some((d) => d.id === "review-frequency")).toBe(false);
    expect(result.openArguments).toEqual([]);
  });

  it("raises the 24 month point as an argument, not a defect, on an older tenancy", () => {
    const result = assessNotice(
      notice({
        tenancyStart: parseDate("2024-01-01"),
        previousSetting: parseDate("2025-05-01"),
        servedOnTenant: parseDate("2026-06-01"),
      }),
    );
    // Must not become a defect. My reading of section 20 is not the RTB's.
    expect(result.defects.some((d) => d.id.startsWith("review-frequency"))).toBe(false);
    const argument = result.openArguments.find(
      (a) => a.id === "review-frequency-24-month-argument",
    );
    expect(argument?.severity).toBe("unclear");
    expect(argument?.finding).toContain("RTB's published position");
    expect(argument?.finding).toContain("not a conclusion");
    expect(argument?.finding).toContain("Threshold");
  });

  it("drops the argument once the extended period has ended", () => {
    const result = assessNotice(
      notice({
        tenancyStart: parseDate("2024-01-01"),
        previousSetting: parseDate("2027-01-01"),
        servedOnTenant: parseDate("2028-06-01"),
        newRentEffectiveFrom: parseDate("2028-09-30"),
        asOf: parseDate("2028-06-01"),
      }),
    );
    expect(result.openArguments).toEqual([]);
  });

  it("asks when the tenancy started rather than assuming", () => {
    // `exactOptionalPropertyTypes` means the key has to be absent, not set to undefined,
    // which is the distinction the compiler is right to enforce here.
    const { tenancyStart: _omitted, ...withoutStart } = notice();
    const result = assessNotice(withoutStart);
    expect(result.notAssessed.some((n) => n.id === "review-frequency-tenancy-age")).toBe(true);
  });
});

describe("R-NOT-04, required contents", () => {
  const cases: { key: keyof NoticeContents; id: string }[] = [
    { key: "prescribedForm", id: "prescribed-form" },
    { key: "statesNewRent", id: "states-new-rent" },
    { key: "statesEffectiveDate", id: "states-effective-date" },
    { key: "statesDisputeDeadline", id: "states-dispute-deadline" },
    { key: "marketRentStatement", id: "market-rent-statement" },
    { key: "threeComparables", id: "three-comparables" },
    { key: "comparablesHaveRtNumbers", id: "comparables-rt-numbers" },
    { key: "statesFloorArea", id: "states-floor-area" },
    { key: "showsCalculation", id: "shows-calculation" },
    { key: "statesSignatureDate", id: "states-signature-date" },
  ];

  for (const { key, id } of cases) {
    it(`catches a missing ${key}`, () => {
      const result = assessNotice(notice({ contents: { ...goodContents(), [key]: "no" } }));
      const defect = result.defects.find((d) => d.id === id);
      expect(defect, `expected a defect with id ${id}`).toBeDefined();
      expect(defect?.severity).toBe("rent-has-no-effect");
      expect(defect?.citation.provision).toMatch(/^s\. 22/);
      expect(result.rentTakesEffect).toBe(false);
    });
  }

  it("every defect cites a real provision with a URL", () => {
    const result = assessNotice(
      notice({ contents: { ...goodContents(), threeComparables: "no", signed: "no" } }),
    );
    for (const defect of result.defects) {
      expect(defect.citation.url).toMatch(/^https:\/\//);
      expect(defect.citation.provision.length).toBeGreaterThan(0);
      expect(defect.requirement.length).toBeGreaterThan(10);
    }
  });
});

describe("R-NOT-05 and R-NOT-06, severity is honest", () => {
  it("treats an unsigned notice as unclear, not as voiding", () => {
    // Section 22(2B) sits outside the section 22(2) condition. Claiming it voids the
    // increase would send someone into a dispute on a weaker footing than they think.
    const result = assessNotice(notice({ contents: { ...goodContents(), signed: "no" } }));
    const defect = result.defects.find((d) => d.id === "signed");
    expect(defect?.severity).toBe("unclear");
    expect(result.rentTakesEffect).toBe("unclear");
  });

  it("does not assert a missing BER as a defect", () => {
    // The BER is only required where the EPBD regulations apply, which a tenant cannot
    // reliably determine.
    const result = assessNotice(notice({ contents: { ...goodContents(), statesBer: "no" } }));
    expect(result.defects.some((d) => d.id === "states-ber")).toBe(false);
    expect(result.notAssessed.some((n) => n.id === "states-ber")).toBe(true);
  });

  it("orders severity so the serious things come first", () => {
    expect(severityRank("rent-has-no-effect")).toBeLessThan(severityRank("review-not-permitted"));
    expect(severityRank("review-not-permitted")).toBeLessThan(severityRank("breach"));
    expect(severityRank("breach")).toBeLessThan(severityRank("unclear"));
  });

  it("names the offence only when the notice actually fails the condition", () => {
    const bad = assessNotice(notice({ servedOnBoard: "not-served" }));
    const good = assessNotice(notice());
    expect(bad.citations.some((c) => c.provision === "s. 22(4)")).toBe(true);
    expect(good.citations.some((c) => c.provision === "s. 22(4)")).toBe(false);
  });
});

describe("the dispute deadline, section 22(3)", () => {
  it("is the effective date when that is later, which is the normal case", () => {
    const deadline = disputeDeadline(notice());
    expect(formatDate(deadline.date)).toBe("2026-09-01");
    expect(deadline.basis).toBe("effective-date");
  });

  it("is 28 days from receipt when the effective date is sooner", () => {
    const deadline = disputeDeadline(
      notice({
        servedOnTenant: parseDate("2026-06-01"),
        receivedByTenant: parseDate("2026-06-05"),
        newRentEffectiveFrom: parseDate("2026-06-10"),
      }),
    );
    expect(formatDate(deadline.date)).toBe("2026-07-03");
    expect(deadline.basis).toBe("28-days-from-receipt");
  });

  it("counts down, and says when it has passed", () => {
    const live = disputeDeadline(notice({ asOf: parseDate("2026-08-25") }));
    expect(live.daysRemaining).toBe(7);
    expect(live.passed).toBe(false);

    const gone = disputeDeadline(notice({ asOf: parseDate("2026-09-15") }));
    expect(gone.daysRemaining).toBe(-14);
    expect(gone.passed).toBe(true);
  });

  it("always returns a deadline, whatever else is wrong with the notice", () => {
    const result = assessNotice(notice({ servedOnBoard: "not-served" }));
    expect(result.disputeDeadline).not.toBeNull();
  });
});

describe("the scenario this product exists for", () => {
  it("a lawful increase, void because the RTB copy was posted", () => {
    const result = assessNotice(
      notice({
        servedOnTenant: parseDate("2026-06-01"),
        servedOnBoard: parseDate("2026-06-04"),
      }),
    );
    expect(result.rentTakesEffect).toBe(false);
    const defect = result.defects.find((d) => d.id === "board-same-day");
    expect(defect?.severity).toBe("rent-has-no-effect");
    expect(result.citations.some((c) => c.provision === "s. 22(1)")).toBe(true);
    expect(result.citations.some((c) => c.provision === "s. 22(3)")).toBe(true);
  });
});

describe("R-OUT-06, never throws", () => {
  it("survives any combination of dates and answers", () => {
    const answer = fc.constantFrom<Answer>("yes", "no", "unknown");
    fc.assert(
      fc.property(
        fc.integer({ min: -400, max: 400 }),
        fc.integer({ min: -400, max: 400 }),
        answer,
        answer,
        fc.boolean(),
        (serveOffset, effectOffset, a, b, omitContents) => {
          const base = parseDate("2026-01-01");
          const contents: NoticeContents = {
            ...goodContents(),
            signed: a,
            threeComparables: b,
          };
          const query: NoticeQuery = {
            servedOnTenant: shift(base, serveOffset),
            servedOnBoard: shift(base, serveOffset + 1),
            newRentEffectiveFrom: shift(base, effectOffset),
            previousSetting: shift(base, -400),
            tenancyStart: shift(base, -800),
            asOf: base,
            // Also exercise the path where the tenant answered nothing about the contents.
            ...(omitContents ? {} : { contents }),
          };
          const result = assessNotice(query);
          return Array.isArray(result.defects) && result.disputeDeadline !== null;
        },
      ),
      { numRuns: 1000 },
    );
  });
});

function shift(date: { y: number; m: number; d: number }, days: number) {
  const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = (y: number, m: number) =>
    [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
  let { y, m, d } = date;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i !== days; i += step) {
    d += step;
    if (d < 1) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      d = dim(y, m);
    } else if (d > dim(y, m)) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return { y, m, d };
}
