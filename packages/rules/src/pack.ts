/**
 * The dispute pack: plain English summaries and a letter, generated from a determination.
 *
 * Deterministic and pure, like everything else here. No model runs at request time, because
 * a determination contains someone's rent and dates and the page promises those never leave
 * their device. ADR-0008.
 *
 * The writing constraints are not stylistic. Someone reads this after being told their rent
 * is going up, so:
 *
 * - Short sentences. The readability test in `pack.test.ts` fails the build if the prose
 *   drifts above a Flesch-Kincaid grade of 10.
 * - No legal vocabulary without an immediate gloss. "Section 22(2)" always arrives attached
 *   to what it requires.
 * - Never predict what an adjudicator will do. R-SAFE-04. The letter states a position and
 *   asks a question; it does not threaten an outcome.
 */

import type { Citation } from "./citations";
import { CITATIONS } from "./citations";
import { formatDate, type PlainDate } from "./dates";
import { type Cents, formatEuroDisplay } from "./money";
import type { DisputeDeadline, NoticeAssessment } from "./notice";
import type { Determination } from "./types";

export interface PlainSummary {
  /** One sentence. The thing to read if you read nothing else. */
  readonly headline: string;
  /** What the tool worked out, in order. */
  readonly points: readonly string[];
  /** What to do about it. Never a prediction, always an action. */
  readonly nextSteps: readonly string[];
  readonly citations: readonly Citation[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "1 September 2026". Used in prose, where an ISO date reads badly. */
export function longDate(date: PlainDate): string {
  return `${date.d} ${MONTHS[date.m - 1] ?? "?"} ${date.y}`;
}

/** Prose uses thousands separators. "€2,050.00" reads; "€2050.00" is a serial number. */
function euro(amount: Cents): string {
  return formatEuroDisplay(amount);
}

/** A plain English account of a rent determination. */
export function summariseRent(determination: Determination): PlainSummary {
  switch (determination.outcome) {
    case "capped": {
      const { headline, statutory, proposedIsLawful } = determination;
      const points: string[] = [
        `The most your landlord can lawfully charge is ${euro(headline.maxRent)} a month.`,
        `That is an increase of ${euro(headline.maxIncrease)} on what you pay now.`,
      ];

      if (headline.percentageCap !== null && headline.indexCap !== null) {
        const binding = headline.bindingConstraint === "percentage" ? "2 per cent" : "inflation";
        points.push(
          `Two limits apply and the lower one wins. Here the ${binding} limit is lower, so it sets the maximum.`,
        );
      } else if (headline.percentageCap === null) {
        points.push(
          "The 2 per cent limit does not apply to this home, so only the inflation limit sets the maximum.",
        );
      }

      const gap = statutory.maxRent - headline.maxRent;
      if (gap !== 0) {
        points.push(
          `That figure follows the RTB's own rent calculator. Reading the Act strictly gives ${euro(statutory.maxRent)} instead.`,
        );
        points.push(`The two differ by ${euro(Math.abs(gap) as Cents)} a month.`);
      }

      const nextSteps: string[] = [];
      if (proposedIsLawful === false) {
        nextSteps.push("Write to your landlord. There is a draft letter in this pack.");
        nextSteps.push(
          "If they do not change it, you can refer the matter to the RTB. Do that before the deadline.",
        );
      } else if (proposedIsLawful === true) {
        nextSteps.push(
          "The amount you were asked for is inside the limit, so there is nothing to dispute on the figure.",
        );
        nextSteps.push(
          "The notice itself is a separate question. A lawful amount asked for in the wrong way still does not take effect.",
        );
      } else {
        nextSteps.push("Compare this figure with the amount on your notice.");
      }
      nextSteps.push("Threshold give free advice on 1800 454 454.");

      return {
        headline:
          proposedIsLawful === false
            ? "The rent you are being asked for is above the legal limit."
            : proposedIsLawful === true
              ? "The rent you are being asked for is within the legal limit."
              : `The legal limit for your rent is ${euro(headline.maxRent)} a month.`,
        points,
        nextSteps,
        citations: determination.citations,
      };
    }

    case "no-cap":
      return {
        headline: "No percentage limit applies to this tenancy.",
        points: [
          determination.explanation,
          "The rent still may not be set above the market rent for a similar home nearby.",
        ],
        nextSteps: [
          "If you think the rent is above market rent, that is the ground to raise.",
          "Threshold give free advice on 1800 454 454.",
        ],
        citations: determination.citations,
      };

    case "unknown":
      return {
        headline: "The limit depends on one thing we cannot check for you.",
        points: [
          determination.question,
          ...determination.branches.map((branch) =>
            branch.determination.outcome === "capped"
              ? `${branch.answer} The limit would be ${euro(branch.determination.headline.maxRent)} a month.`
              : branch.answer,
          ),
        ],
        nextSteps: [determination.howToFindOut, "Threshold give free advice on 1800 454 454."],
        citations: determination.citations,
      };

    case "not-answerable":
      return {
        headline: "This tool cannot answer your question.",
        points: [determination.problem, determination.detail],
        nextSteps: ["Threshold give free advice on 1800 454 454."],
        citations: determination.citations,
      };

    default:
      return {
        headline: "No result.",
        points: [],
        nextSteps: [],
        citations: [],
      };
  }
}

/** A plain English account of a notice assessment. */
export function summariseNotice(assessment: NoticeAssessment): PlainSummary {
  const voiding = assessment.defects.filter((d) => d.severity === "rent-has-no-effect");
  const points: string[] = [];

  if (voiding.length > 0) {
    points.push(
      "A rent increase only takes effect if the notice meets the rules. This one does not, on what you have told us.",
    );
    for (const defect of voiding) {
      points.push(defect.finding);
    }
  }

  for (const defect of assessment.defects) {
    if (defect.severity === "review-not-permitted") {
      points.push(`${defect.finding} Rent may only be reviewed once every 12 months.`);
    }
  }

  if (assessment.notAssessed.length > 0) {
    points.push(
      `${assessment.notAssessed.length} thing${assessment.notAssessed.length === 1 ? " was" : "s were"} not checked, because you did not answer.`,
    );
    points.push("They are listed at the end. They are not problems, they are gaps.");
  }

  const nextSteps: string[] = [];
  if (assessment.disputeDeadline !== null) {
    nextSteps.push(deadlineSentence(assessment.disputeDeadline));
  }
  if (voiding.length > 0) {
    nextSteps.push("Write to your landlord. There is a draft letter in this pack.");
    nextSteps.push(
      "If they do not withdraw it, refer the matter to the RTB before the deadline above.",
    );
  }
  nextSteps.push("Threshold give free advice on 1800 454 454.");

  return {
    headline:
      assessment.rentTakesEffect === false
        ? "On what you have told us, this increase did not take effect."
        : assessment.rentTakesEffect === true
          ? "Nothing you told us makes this notice invalid."
          : "Some of this notice could not be checked.",
    points,
    nextSteps,
    citations: assessment.citations,
  };
}

/** The one sentence that matters most in the whole product. R-SAFE-02. */
export function deadlineSentence(deadline: DisputeDeadline): string {
  if (deadline.passed) {
    return `Your deadline to dispute this was ${longDate(deadline.date)}, which has passed. Talk to Threshold before assuming it is too late.`;
  }
  if (deadline.daysRemaining === 0) {
    return `Today is your last day to refer a dispute to the RTB about this rent.`;
  }
  return `You have until ${longDate(deadline.date)} to refer a dispute to the RTB. That is ${deadline.daysRemaining} day${deadline.daysRemaining === 1 ? "" : "s"} away.`;
}

export interface LetterOptions {
  /** Optional, and only ever used locally. Left blank if the person does not type it. */
  readonly tenantName?: string;
  readonly landlordName?: string;
  readonly propertyAddress?: string;
  readonly today: PlainDate;
}

/**
 * A letter to the landlord.
 *
 * Deliberately calm. It states a position, cites the provision, and asks for a response by
 * a date. It does not threaten, does not predict what the RTB would decide, and does not
 * mention that a defective notice is an offence, because putting that in a first letter
 * turns a fixable disagreement into a fight.
 */
export function landlordLetter(
  determination: Determination | null,
  assessment: NoticeAssessment | null,
  options: LetterOptions,
): string {
  const lines: string[] = [];
  const address = options.propertyAddress?.trim();
  const landlord = options.landlordName?.trim();
  const tenant = options.tenantName?.trim();

  lines.push(longDate(options.today));
  lines.push("");
  lines.push(landlord !== undefined && landlord !== "" ? `Dear ${landlord},` : "Dear landlord,");
  lines.push("");
  lines.push(
    address !== undefined && address !== ""
      ? `Re: the rent review notice for ${address}`
      : "Re: the rent review notice for my home",
  );
  lines.push("");

  const voiding =
    assessment?.defects.filter((defect) => defect.severity === "rent-has-no-effect") ?? [];

  if (voiding.length > 0) {
    lines.push(
      "I have looked at the notice you served. I do not think it meets the requirements in section 22 of the Residential Tenancies Act 2004.",
    );
    lines.push(
      "Section 22(1) says a rent set on review does not take effect unless those requirements are met.",
    );
    lines.push("");
    lines.push("Specifically:");
    for (const defect of voiding) {
      lines.push(`  - ${defect.finding} ${defect.requirement}`);
    }
    lines.push("");
  }

  if (determination?.outcome === "capped" && determination.proposedIsLawful === false) {
    lines.push(
      "I have also checked the amount, using the same rules as the RTB's rent calculator.",
    );
    lines.push(
      `On the dates in the notice, the maximum lawful rent is ${euro(determination.headline.maxRent)} a month.`,
    );
    lines.push(
      `That is an increase of ${euro(determination.headline.maxIncrease)}. The amount in your notice is above it.`,
    );
    lines.push("");
    lines.push("My working:");
    for (const step of determination.audit) {
      if (step.value !== undefined) {
        lines.push(`  - ${step.label}: ${step.value}`);
      }
    }
    lines.push("");
  }

  lines.push(
    "I am not trying to make this difficult. I would rather sort it out directly than involve anyone else.",
  );
  lines.push("Could you confirm in writing whether you intend to withdraw or correct the notice?");
  lines.push("");

  if (assessment?.disputeDeadline != null && !assessment.disputeDeadline.passed) {
    lines.push(
      `I would be grateful for a reply before ${longDate(assessment.disputeDeadline.date)}.`,
    );
    lines.push(
      "That is the date by which I would have to refer the matter to the RTB if it is not resolved.",
    );
    lines.push("");
  }

  lines.push("Yours sincerely,");
  lines.push("");
  lines.push(tenant !== undefined && tenant !== "" ? tenant : "[your name]");

  return lines.join("\n");
}

/** Everything a printed pack needs, assembled once so the page just lays it out. */
export interface DisputePack {
  readonly generatedOn: PlainDate;
  readonly rent: PlainSummary | null;
  readonly notice: PlainSummary | null;
  readonly letter: string;
  readonly citations: readonly Citation[];
  readonly provenance: string;
}

export function buildPack(
  determination: Determination | null,
  assessment: NoticeAssessment | null,
  options: LetterOptions,
): DisputePack {
  const rent = determination === null ? null : summariseRent(determination);
  const notice = assessment === null ? null : summariseNotice(assessment);

  const citations = new Map<string, Citation>();
  for (const citation of [
    ...(rent?.citations ?? []),
    ...(notice?.citations ?? []),
    CITATIONS.noticeEffect,
    CITATIONS.disputeDeadline,
  ]) {
    citations.set(`${citation.act}|${citation.provision}`, citation);
  }

  const provenance =
    determination === null
      ? "Generated by tenant, in your browser."
      : `Generated by tenant on ${formatDate(options.today)}, in your browser. Rules version ${determination.provenance.rulesVersion}, CPI data to ${determination.provenance.cpiLatestMonth}, snapshot ${determination.provenance.cpiSnapshotSha256.slice(0, 12)}.`;

  return {
    generatedOn: options.today,
    rent,
    notice,
    // A letter is worth writing whenever there is something to say, and a defective notice
    // is often the stronger of the two grounds. Requiring a rent determination meant someone
    // who only checked their notice got no letter at all.
    letter:
      determination === null && assessment === null
        ? ""
        : landlordLetter(determination, assessment, options),
    citations: [...citations.values()],
    provenance,
  };
}
