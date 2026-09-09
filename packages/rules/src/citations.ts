/**
 * Every branch that decides an outcome names the provision it decided on. R-OUT-02.
 *
 * The point is not decoration. A tenant may put this in front of an RTB adjudicator, and
 * "a website said so" is worth nothing there while "section 22(3) of the Residential
 * Tenancies Act 2004" is worth something. It also keeps us honest: a rule with no citation
 * is a rule somebody invented.
 *
 * URLs point at the Law Reform Commission's revised Acts where the provision has been
 * amended, because the amended text is the operative one, and at the Irish Statute Book
 * for provisions read as enacted.
 */

export interface Citation {
  /** Short name of the Act, as a lawyer would write it. */
  readonly act: string;
  /** The provision, e.g. "s. 19(4)(b)". */
  readonly provision: string;
  /** Where to read it. */
  readonly url: string;
  /** What this provision does, in one line, for a reader who is not a lawyer. */
  readonly effect: string;
}

const RTA_2004 = "Residential Tenancies Act 2004 (as amended)";
const RTA_2004_S19 = "https://revisedacts.lawreform.ie/eli/2004/act/27/section/19/revised/en/html";
const RTA_2004_S20 = "https://revisedacts.lawreform.ie/eli/2004/act/27/section/20/revised/en/html";
const RTA_2004_S22 = "https://revisedacts.lawreform.ie/eli/2004/act/27/section/22/revised/en/html";

export const CITATIONS = {
  marketRentProhibition: {
    act: RTA_2004,
    provision: "s. 19(1)",
    url: RTA_2004_S19,
    effect: "Rent may never be set above the market rent, whatever else applies.",
  },
  capApplies: {
    act: RTA_2004,
    provision: "s. 19(4)(a)",
    url: RTA_2004_S19,
    effect:
      "A rent review must satisfy both a percentage cap and a CPI ratio cap. Neither one alone is the limit.",
  },
  percentageCap: {
    act: RTA_2004,
    provision: "s. 19(4)(b)",
    url: RTA_2004_S19,
    effect:
      "The percentage cap is 2 per cent of the old rent for each year elapsed since the last setting, plus a proportionate share for any remaining part year.",
  },
  cpiDefinitions: {
    act: RTA_2004,
    provision: "s. 19(4)(b)",
    url: RTA_2004_S19,
    effect:
      "The current CPI number is the month before the new setting. The previous CPI number is the month of the previous setting if that was before 1 March 2026, and the month before it if on or after.",
  },
  newBuildExemption: {
    act: RTA_2004,
    provision: "s. 19(4)(aa)",
    url: RTA_2004_S19,
    effect:
      "The 2 per cent cap does not apply to an apartment complex or student specific accommodation whose building control commencement notice was given on or after 10 June 2025. Only the CPI cap applies.",
  },
  marketRentPaths: {
    act: RTA_2004,
    provision: "s. 19(5)",
    url: RTA_2004_S19,
    effect:
      "The cap does not apply at all in listed cases, including the first setting after a two year vacancy and the setting at the end of a six year tenancy of minimum duration.",
  },
  preCommencementNotice: {
    act: RTA_2004,
    provision: "s. 19(6)",
    url: RTA_2004_S19,
    effect:
      "Where a rent review notice was served before 1 March 2026, the rent is governed by the law as it stood before that date, using HICP rather than CPI.",
  },
  cpiTablePublication: {
    act: RTA_2004,
    provision: "s. 19(4C)(b)",
    url: RTA_2004_S19,
    effect:
      "The operative CPI numbers are those the RTB publishes, drawn from the Central Statistics Office series.",
  },
  reviewFrequency: {
    act: RTA_2004,
    provision: "s. 20(1)",
    url: RTA_2004_S20,
    effect:
      "A rent review may not occur more than once in each 12 month period, nor in the first 12 months of a tenancy.",
  },
  reviewFrequencyExtended: {
    act: RTA_2004,
    provision: "s. 20(4) to (6)",
    url: RTA_2004_S20,
    effect:
      "For a period ending 20 June 2027, those 12 month references are to be read as 24 months. Section 20B(2) disapplies this for tenancies commencing on or after 1 March 2026.",
  },
  noticeEffect: {
    act: RTA_2004,
    provision: "s. 22(1)",
    url: RTA_2004_S22,
    effect:
      "A rent set on review has no effect at all unless the notice requirements are satisfied.",
  },
  noticeRequirements: {
    act: RTA_2004,
    provision: "s. 22(2)",
    url: RTA_2004_S22,
    effect:
      "The notice must be served at least 90 days before the new rent takes effect, in the prescribed form, with a copy served on the RTB the same day.",
  },
  disputeDeadline: {
    act: RTA_2004,
    provision: "s. 22(3)",
    url: RTA_2004_S22,
    effect:
      "A dispute about a rent set on review must reach the RTB before the later of the date the rent takes effect or 28 days after the tenant received the notice.",
  },
  noticeContents: {
    act: RTA_2004,
    provision: "s. 22(2A)",
    url: RTA_2004_S22,
    effect:
      "The notice must state the dispute deadline, a statement that the rent is not above market rent, three comparable dwellings from the published register with their RT numbers, the floor area, the BER where applicable, the date it was signed, and how the rent was calculated under section 19(4).",
  },
  noticeComparables: {
    act: RTA_2004,
    provision: "s. 22(2A)(d)",
    url: RTA_2004_S22,
    effect:
      "Three dwellings of similar floor area, bedrooms, type, character and BER in a comparable area, taken from the published register, each identified by the number assigned under section 135(3).",
  },
  noticeCalculationShown: {
    act: RTA_2004,
    provision: "s. 22(2A)(f) and (g)",
    url: RTA_2004_S22,
    effect:
      "The notice must show how the rent was calculated having regard to section 19(4), or state why section 19(4) does not apply.",
  },
  noticeSignature: {
    act: RTA_2004,
    provision: "s. 22(2B)",
    url: RTA_2004_S22,
    effect: "The notice must be signed by the landlord or an authorised agent.",
  },
  noticeOffence: {
    act: RTA_2004,
    provision: "s. 22(4)",
    url: RTA_2004_S22,
    effect:
      "It is a criminal offence for a landlord to set a rent on review by serving a notice that does not meet the section 22(2) condition.",
  },
  reviewFrequencyNewTenancies: {
    act: RTA_2004,
    provision: "s. 20B(2)",
    url: RTA_2004_S20,
    effect:
      "For a tenancy commencing on or after 1 March 2026, the review is carried out as if the 24 month extension in section 20(4) to (6) had never been enacted, so the interval is 12 months.",
  },
  costRentalExcluded: {
    act: "Affordable Housing Act 2021",
    provision: "s. 33(1)",
    url: "https://www.irishstatutebook.ie/eli/2021/act/25/section/33/enacted/en/html",
    effect:
      "Part 3 of the 2004 Act, which contains the rent rules, does not apply to a cost rental tenancy.",
  },
  amendingAct: {
    act: "Residential Tenancies (Miscellaneous Provisions) Act 2026",
    provision: "No. 3 of 2026",
    url: "https://www.irishstatutebook.ie/eli/2026/act/3/enacted/en/html",
    effect:
      "The Act that replaced Rent Pressure Zones with national rent control on 1 March 2026, by amending the 2004 Act.",
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;
