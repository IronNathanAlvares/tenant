/**
 * Notice validity, section 22 of the Residential Tenancies Act 2004 as amended.
 *
 * This is the half of the product that matters most, and the half nothing else does.
 *
 * A rent increase can sit perfectly inside the section 19(4) cap and still be worth
 * nothing, because section 22(1) says a rent set on review "shall not have effect unless
 * and until the condition specified in subsection (2) is satisfied". The condition is
 * detailed and easy to breach. The most breachable part is new: since 1 March 2026 a copy
 * of the notice must reach the RTB **on the same day** it reaches the tenant, and the RTB
 * warns that posting it can miss that by itself.
 *
 * So a landlord who posted the notice rather than uploading it has handed the tenant a
 * complete answer, and no other tool asks the question.
 *
 * Two design commitments run through this file.
 *
 * **Not every breach voids the increase.** Telling someone their notice is invalid when it
 * is merely irregular sends them into a dispute they lose. Severity is modelled
 * explicitly, and where the law does not clearly say, the answer is that it does not
 * clearly say.
 *
 * **An unanswered question is not a passed check.** Every requirement takes yes, no or
 * unknown, and unknown produces an entry in `notAssessed` rather than silence. A tenant who
 * answered three questions should be told what the other ten would have covered.
 */

import { CITATIONS, type Citation } from "./citations";
import { NATIONAL_RENT_CONTROL_START } from "./cpi";
import { addYears, compareDates, daysBetween, formatDate, type PlainDate } from "./dates";
import { assertNever } from "./types";

/** Tri-state. `unknown` is what a tenant who has not looked at the notice closely says. */
export type Answer = "yes" | "no" | "unknown";

/**
 * The last day of the extended review interval in section 20(6), being two years after the
 * Residential Tenancies (Amendment) Act 2025 came into operation on 20 June 2025.
 */
const EXTENDED_REVIEW_PERIOD_ENDS: PlainDate = { y: 2027, m: 6, d: 20 };

/** The minimum notice period before a new rent may take effect. Section 22(2). */
export const NOTICE_PERIOD_DAYS = 90;

/** Section 22(3), the second limb of the dispute deadline. */
export const DISPUTE_WINDOW_DAYS = 28;

export type Severity =
  /** Section 22(1). The condition in 22(2) is not met, so the new rent never took effect. */
  | "rent-has-no-effect"
  /** Section 20. The review should not have happened at all when it did. */
  | "review-not-permitted"
  /** Unlawful, but does not by itself stop the increase taking effect. */
  | "breach"
  /** The law does not clearly say what follows. Presented as an argument, not a conclusion. */
  | "unclear";

export interface Defect {
  /** Stable across releases, so the interface and the tests can both refer to it. */
  readonly id: string;
  readonly requirement: string;
  readonly finding: string;
  readonly severity: Severity;
  readonly citation: Citation;
}

export interface NotAssessed {
  readonly id: string;
  readonly question: string;
  readonly whyItMatters: string;
}

/** What the notice says. Each field answers "does the notice contain this?" */
export interface NoticeContents {
  readonly prescribedForm?: Answer;
  readonly statesNewRent?: Answer;
  readonly statesEffectiveDate?: Answer;
  readonly statesDisputeDeadline?: Answer;
  readonly marketRentStatement?: Answer;
  readonly threeComparables?: Answer;
  readonly comparablesHaveRtNumbers?: Answer;
  readonly statesFloorArea?: Answer;
  readonly statesBer?: Answer;
  readonly statesSignatureDate?: Answer;
  readonly showsCalculation?: Answer;
  readonly signed?: Answer;
}

export interface NoticeQuery {
  /** When the notice was served on the tenant. */
  readonly servedOnTenant: PlainDate;
  /** When a copy reached the RTB. `"not-served"` if it never did. */
  readonly servedOnBoard?: PlainDate | "not-served" | "unknown";
  /** When the tenant actually received it, if different from service. */
  readonly receivedByTenant?: PlainDate;
  /** The date the new rent is stated to take effect. */
  readonly newRentEffectiveFrom: PlainDate;
  /** When the rent was last set, for the frequency check. */
  readonly previousSetting?: PlainDate;
  /** When the tenancy began, which decides which frequency rule applies. */
  readonly tenancyStart?: PlainDate;
  readonly contents?: NoticeContents;
  readonly asOf: PlainDate;
}

/** Section 22(3). The date by which a dispute must reach the RTB. */
export interface DisputeDeadline {
  readonly date: PlainDate;
  readonly basis: "effective-date" | "28-days-from-receipt";
  /** Negative once it has passed. */
  readonly daysRemaining: number;
  readonly passed: boolean;
  readonly citation: Citation;
}

export interface NoticeAssessment {
  readonly defects: readonly Defect[];
  readonly notAssessed: readonly NotAssessed[];
  /**
   * Whether the increase took effect. `false` where a section 22(2) requirement was
   * breached, `"unclear"` where the answer depends on something not supplied.
   */
  readonly rentTakesEffect: boolean | "unclear";
  readonly disputeDeadline: DisputeDeadline | null;
  /**
   * Arguments worth raising that are not defects. Used where the law is genuinely
   * contested, so the tool can surface the point without asserting it.
   */
  readonly openArguments: readonly Defect[];
  readonly citations: readonly Citation[];
}

function add(list: Defect[], defect: Defect): void {
  list.push(defect);
}

/**
 * Section 22(3). A dispute must reach the RTB before the later of the date the rent takes
 * effect, or 28 days after the tenant received the notice.
 *
 * Because a valid notice has to be served 90 days ahead, the effective date is normally the
 * later of the two, which means **in practice the deadline is the day the new rent starts**.
 * That is the most urgent number the product produces and it deserves to be the loudest
 * thing on the page.
 */
export function disputeDeadline(query: NoticeQuery): DisputeDeadline {
  const received = query.receivedByTenant ?? query.servedOnTenant;
  const twentyEightDays = addDays(received, DISPUTE_WINDOW_DAYS);
  const useEffective = compareDates(query.newRentEffectiveFrom, twentyEightDays) >= 0;
  const date = useEffective ? query.newRentEffectiveFrom : twentyEightDays;
  const daysRemaining = daysBetween(query.asOf, date);
  return {
    date,
    basis: useEffective ? "effective-date" : "28-days-from-receipt",
    daysRemaining,
    passed: daysRemaining < 0,
    citation: CITATIONS.disputeDeadline,
  };
}

/**
 * Assess a rent review notice.
 *
 * Pure, like the rest of the engine. Never throws. R-OUT-05, R-OUT-06.
 */
export function assessNotice(query: NoticeQuery): NoticeAssessment {
  const defects: Defect[] = [];
  const openArguments: Defect[] = [];
  const notAssessed: NotAssessed[] = [];
  const contents = query.contents ?? {};

  // ---------------------------------------------------------------- service and timing

  const noticeDays = daysBetween(query.servedOnTenant, query.newRentEffectiveFrom);
  if (noticeDays < NOTICE_PERIOD_DAYS) {
    add(defects, {
      id: "notice-period",
      requirement: `The notice must be served at least ${NOTICE_PERIOD_DAYS} days before the new rent takes effect.`,
      finding:
        noticeDays < 0
          ? `The notice is dated after the rent was due to change, which cannot be right. Check the dates.`
          : `Only ${noticeDays} days' notice was given, ${NOTICE_PERIOD_DAYS - noticeDays} short.`,
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
    });
  }

  // The same-day RTB rule only applies to notices served on or after 1 March 2026. Before
  // that it did not exist, and applying it retrospectively would invent a defect.
  const sameDayRuleApplies = compareDates(query.servedOnTenant, NATIONAL_RENT_CONTROL_START) >= 0;

  if (!sameDayRuleApplies) {
    notAssessed.push({
      id: "board-same-day",
      question: "Was a copy sent to the RTB on the same day?",
      whyItMatters:
        "This requirement only applies to notices served on or after 1 March 2026, so it does not affect this notice.",
    });
  } else if (query.servedOnBoard === undefined || query.servedOnBoard === "unknown") {
    notAssessed.push({
      id: "board-same-day",
      question: "Did a copy of the notice reach the RTB on the same day it reached you?",
      whyItMatters:
        "This is the requirement landlords breach most often, and breaching it means the increase never took effect. If the notice was posted to the RTB rather than uploaded, it very likely missed the same day. You can ask the RTB whether and when they received it.",
    });
  } else if (query.servedOnBoard === "not-served") {
    add(defects, {
      id: "board-same-day",
      requirement:
        "A copy of the notice must be served on the RTB on the same day it is served on the tenant.",
      finding: "No copy was sent to the RTB at all.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
    });
  } else if (compareDates(query.servedOnBoard, query.servedOnTenant) !== 0) {
    const gap = daysBetween(query.servedOnTenant, query.servedOnBoard);
    add(defects, {
      id: "board-same-day",
      requirement:
        "A copy of the notice must be served on the RTB on the same day it is served on the tenant.",
      finding: `The RTB copy is dated ${formatDate(query.servedOnBoard)}, ${Math.abs(gap)} day${
        Math.abs(gap) === 1 ? "" : "s"
      } ${gap > 0 ? "after" : "before"} the notice was served on you.`,
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
    });
  }

  // ----------------------------------------------------------------------- frequency

  assessFrequency(query, defects, openArguments, notAssessed);

  // ------------------------------------------------------------------------ contents

  const required: {
    key: keyof NoticeContents;
    id: string;
    requirement: string;
    missing: string;
    severity: Severity;
    citation: Citation;
    whyItMatters: string;
  }[] = [
    {
      key: "prescribedForm",
      id: "prescribed-form",
      requirement: "The notice must be on the RTB's prescribed Notice of Rent Review form.",
      missing: "The notice does not appear to be on the RTB's prescribed form.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
      whyItMatters: "A notice that is not on the prescribed form does not satisfy section 22(2).",
    },
    {
      key: "statesNewRent",
      id: "states-new-rent",
      requirement: "The notice must state the amount of the new rent.",
      missing: "The notice does not state the new rent amount.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
      whyItMatters: "Without it there is no rent that could take effect.",
    },
    {
      key: "statesEffectiveDate",
      id: "states-effective-date",
      requirement: "The notice must state the date from which the new rent takes effect.",
      missing: "The notice does not state when the new rent starts.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeRequirements,
      whyItMatters: "The date decides both the notice period and your deadline to dispute.",
    },
    {
      key: "statesDisputeDeadline",
      id: "states-dispute-deadline",
      requirement:
        "The notice must tell you that a dispute has to be referred to the RTB, and by when.",
      missing: "The notice does not tell you your deadline for disputing the increase.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeContents,
      whyItMatters:
        "The deadline is short and easy to miss, which is why the landlord has to state it.",
    },
    {
      key: "marketRentStatement",
      id: "market-rent-statement",
      requirement:
        "The notice must include the landlord's statement that the new rent is not above market rent.",
      missing: "The notice does not include a statement that the rent is not above market rent.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeContents,
      whyItMatters: "Rent may never be set above market rent, whatever the cap allows.",
    },
    {
      key: "threeComparables",
      id: "three-comparables",
      requirement:
        "The notice must give three comparable dwellings from the RTB's published register.",
      missing: "The notice does not give three comparable properties.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeComparables,
      whyItMatters:
        "The comparables are how the landlord shows the rent is not above market. Fewer than three, or made-up ones, is a real defect.",
    },
    {
      key: "comparablesHaveRtNumbers",
      id: "comparables-rt-numbers",
      requirement:
        "Each comparable must carry the registration number assigned under section 135(3).",
      missing: "The comparables do not carry RTB registration numbers.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeComparables,
      whyItMatters:
        "Without the registration numbers the comparables cannot be checked against the register, which is the point of them.",
    },
    {
      key: "statesFloorArea",
      id: "states-floor-area",
      requirement: "The notice must state the floor area of your home.",
      missing: "The notice does not state the floor area.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeContents,
      whyItMatters: "Floor area is one of the things the comparables have to be similar on.",
    },
    {
      key: "showsCalculation",
      id: "shows-calculation",
      requirement:
        "The notice must show how the rent was calculated under section 19(4), or say why section 19(4) does not apply.",
      missing: "The notice does not show how the new rent was worked out.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeCalculationShown,
      whyItMatters:
        "This is where the RTB Rent Calculator printout goes. Without it you cannot check the arithmetic.",
    },
    {
      key: "signed",
      id: "signed",
      requirement: "The notice must be signed by the landlord or an authorised agent.",
      missing: "The notice is not signed.",
      // Section 22(2B) sits outside the section 22(2) condition, so on the face of the Act
      // an unsigned notice is a breach without automatically stopping the rent taking
      // effect. Saying that plainly is better than overclaiming.
      severity: "unclear",
      citation: CITATIONS.noticeSignature,
      whyItMatters:
        "The signature requirement is in section 22(2B), which sits outside the section 22(2) condition, so it is arguable whether an unsigned notice stops the increase or is simply a breach.",
    },
    {
      key: "statesSignatureDate",
      id: "states-signature-date",
      requirement: "The notice must include the date on which it was signed.",
      missing: "The notice does not include the date it was signed.",
      severity: "rent-has-no-effect",
      citation: CITATIONS.noticeContents,
      whyItMatters: "The signing date is one of the matters section 22(2A) requires.",
    },
  ];

  for (const item of required) {
    const answer = contents[item.key];
    if (answer === "no") {
      add(defects, {
        id: item.id,
        requirement: item.requirement,
        finding: item.missing,
        severity: item.severity,
        citation: item.citation,
      });
    } else if (answer === undefined || answer === "unknown") {
      notAssessed.push({
        id: item.id,
        question: item.requirement,
        whyItMatters: item.whyItMatters,
      });
    }
  }

  // BER is only required where the energy performance regulations apply to the building,
  // which the tenant cannot reliably determine, so a missing BER is never asserted as a
  // defect from a bare "no".
  if (contents.statesBer === "no") {
    notAssessed.push({
      id: "states-ber",
      question: "Does the notice state the BER?",
      whyItMatters:
        "The BER is required only where the building falls under the Energy Performance of Buildings Regulations 2012. Most rented homes do, but not all, so a missing BER is worth raising rather than relying on.",
    });
  }

  // -------------------------------------------------------------------------- outcome

  const voiding = defects.filter((d) => d.severity === "rent-has-no-effect");
  const anyUnclear = defects.some((d) => d.severity === "unclear");
  const rentTakesEffect: boolean | "unclear" =
    voiding.length > 0 ? false : notAssessed.length > 0 || anyUnclear ? "unclear" : true;

  const citations = new Map<string, Citation>();
  for (const defect of [...defects, ...openArguments]) {
    citations.set(`${defect.citation.act}|${defect.citation.provision}`, defect.citation);
  }
  citations.set("effect", CITATIONS.noticeEffect);
  citations.set("deadline", CITATIONS.disputeDeadline);
  if (voiding.length > 0) {
    // Worth naming, carefully: a non-compliant notice is a criminal offence, not merely
    // ineffective. That is a fact about the landlord's position, not a threat to make.
    citations.set("offence", CITATIONS.noticeOffence);
  }

  return {
    defects,
    notAssessed,
    rentTakesEffect,
    disputeDeadline: disputeDeadline(query),
    openArguments,
    citations: [...citations.values()],
  };
}

/**
 * Section 20, how often a review may happen.
 *
 * This is the one place the law is genuinely contested and the product must not pick a
 * side. Section 20(1) says once every 12 months. Section 20(4) to (6) says that for a
 * period ending 20 June 2027 those references read as 24 months, and section 20B(2),
 * inserted in 2026, disapplies that only for tenancies commencing on or after 1 March 2026.
 *
 * Read literally, a tenancy that started before 1 March 2026 is still on a 24 month cycle
 * until June 2027. The RTB's published position is 12 months, with 24 only where the
 * repealed section 24C applied.
 *
 * So: under 12 months is a defect on any reading. Between 12 and 24 months on an older
 * tenancy is presented as an open argument, not a defect. Doc 01 §5b, open question 7.
 */
function assessFrequency(
  query: NoticeQuery,
  defects: Defect[],
  openArguments: Defect[],
  notAssessed: NotAssessed[],
): void {
  if (query.previousSetting === undefined) {
    notAssessed.push({
      id: "review-frequency",
      question: "When was your rent last set or reviewed?",
      whyItMatters:
        "Rent may generally only be reviewed once every 12 months, and for some older tenancies the interval may be longer.",
    });
    return;
  }

  const oneYearOn = addYears(query.previousSetting, 1);
  if (compareDates(query.servedOnTenant, oneYearOn) < 0) {
    const days = daysBetween(query.previousSetting, query.servedOnTenant);
    add(defects, {
      id: "review-frequency",
      requirement: "Rent may not be reviewed more than once in each 12 month period.",
      finding: `The rent was last set on ${formatDate(query.previousSetting)}, ${days} days before this notice.`,
      severity: "review-not-permitted",
      citation: CITATIONS.reviewFrequency,
    });
    return;
  }

  const startedBeforeCommencement =
    query.tenancyStart !== undefined &&
    compareDates(query.tenancyStart, NATIONAL_RENT_CONTROL_START) < 0;
  const withinExtendedPeriod = compareDates(query.asOf, EXTENDED_REVIEW_PERIOD_ENDS) <= 0;
  const twoYearsOn = addYears(query.previousSetting, 2);
  const underTwoYears = compareDates(query.servedOnTenant, twoYearsOn) < 0;

  if (startedBeforeCommencement && withinExtendedPeriod && underTwoYears) {
    openArguments.push({
      id: "review-frequency-24-month-argument",
      requirement:
        "For a period ending 20 June 2027, section 20(4) to (6) reads the 12 month interval in section 20(1) as 24 months. Section 20B(2) removes that only for tenancies that began on or after 1 March 2026.",
      finding:
        "Your tenancy began before 1 March 2026 and this review is less than 24 months after the last one. The RTB's published position is that 12 months is enough, and that is very likely how a dispute would be decided. But on the face of section 20 there is an argument that 24 months applies to a tenancy of this age until June 2027. This is worth asking Threshold about. It is not a conclusion.",
      severity: "unclear",
      citation: CITATIONS.reviewFrequencyExtended,
    });
    return;
  }

  if (query.tenancyStart === undefined) {
    notAssessed.push({
      id: "review-frequency-tenancy-age",
      question: "When did your tenancy start?",
      whyItMatters:
        "For tenancies that began before 1 March 2026 there is an argument that reviews must be 24 months apart rather than 12, until June 2027.",
    });
  }
}

/** Local, because the engine has no general date-addition helper and does not need one. */
function addDays(date: PlainDate, days: number): PlainDate {
  const target = daysToDate(dateToDays(date) + days);
  return target;
}

function dateToDays(date: PlainDate): number {
  const y = date.m <= 2 ? date.y - 1 : date.y;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (date.m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + date.d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function daysToDate(days: number): PlainDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? y + 1 : y, m, d };
}

/** Severity ordering for the interface: most serious first. */
export function severityRank(severity: Severity): number {
  switch (severity) {
    case "rent-has-no-effect":
      return 0;
    case "review-not-permitted":
      return 1;
    case "breach":
      return 2;
    case "unclear":
      return 3;
    default:
      return assertNever(severity, "severityRank");
  }
}
