/**
 * Which body of rules governs this query.
 *
 * Seven regimes run in parallel in Ireland right now. This is the piece that makes the
 * engine dated rather than a calculator: the same facts resolve differently depending on
 * when the notice was served and when the tenancy began. ADR-0001.
 *
 * Order matters here and is not arbitrary. Exclusions from rent control are checked before
 * anything else, because there is no point computing a cap for a tenancy the cap does not
 * reach. The in-flight notice check comes next, because section 19(6) sends the whole
 * question to the repealed regime regardless of everything after it.
 */

import { CITATIONS, type Citation } from "./citations";
import { NATIONAL_RENT_CONTROL_START } from "./cpi";
import { compareDates, type PlainDate } from "./dates";
import { assertNever, type RentQuery } from "./types";

export type Regime =
  /** Cost rental. Part 3 of the 2004 Act does not apply. */
  | { readonly kind: "outside-cost-rental"; readonly citation: Citation }
  /** Approved Housing Body. National rent control does not apply. */
  | { readonly kind: "outside-ahb"; readonly citation: Citation }
  /** A notice served before 1 March 2026. The repealed HICP regime governs. */
  | { readonly kind: "pre-2026-notice"; readonly citation: Citation }
  /** Section 19(5) lets the landlord set market rent. No cap. */
  | { readonly kind: "market-rent-path"; readonly citation: Citation }
  /** Section 19(4)(aa) exemption. CPI only, no 2 per cent cap. */
  | { readonly kind: "cpi-only"; readonly citation: Citation }
  /** The ordinary case. Both caps apply. */
  | { readonly kind: "capped"; readonly citation: Citation }
  /** The 19(4)(aa) question is unresolved and it changes the answer. */
  | { readonly kind: "undetermined-new-build" };

export function resolveRegime(query: RentQuery): Regime {
  switch (query.tenancyKind) {
    case "cost-rental":
      return { kind: "outside-cost-rental", citation: CITATIONS.costRentalExcluded };
    case "approved-housing-body":
      return { kind: "outside-ahb", citation: CITATIONS.marketRentProhibition };
    case "private":
    case "student-specific-accommodation":
      break;
    default:
      return assertNever(query.tenancyKind, "resolveRegime");
  }

  // Section 19(6). A notice served before commencement takes the whole question back to
  // the law as it stood, HICP and all. This is why the engine has to be dated: the correct
  // answer depends on the date of the notice, not the date you are asking.
  if (query.noticeServed !== undefined && isBeforeCommencement(query.noticeServed)) {
    return { kind: "pre-2026-notice", citation: CITATIONS.preCommencementNotice };
  }

  // Section 19(5). Where the landlord may set market rent there is no cap to compute, only
  // the section 19(1) prohibition on exceeding market rent.
  if (query.marketRentPathApplies === true) {
    return { kind: "market-rent-path", citation: CITATIONS.marketRentPaths };
  }

  switch (query.newBuildExemption) {
    case "yes":
      return { kind: "cpi-only", citation: CITATIONS.newBuildExemption };
    case "no":
      return { kind: "capped", citation: CITATIONS.capApplies };
    case "unknown":
      return { kind: "undetermined-new-build" };
    default:
      return assertNever(query.newBuildExemption, "resolveRegime newBuildExemption");
  }
}

export function isBeforeCommencement(date: PlainDate): boolean {
  return compareDates(date, NATIONAL_RENT_CONTROL_START) < 0;
}

/**
 * Whether the 2 per cent cap binds in this regime. The CPI cap always binds where rent
 * control applies at all.
 */
export function percentageCapApplies(regime: Regime): boolean {
  switch (regime.kind) {
    case "capped":
      return true;
    case "cpi-only":
      return false;
    case "outside-cost-rental":
    case "outside-ahb":
    case "pre-2026-notice":
    case "market-rent-path":
    case "undetermined-new-build":
      return false;
    default:
      return assertNever(regime, "percentageCapApplies");
  }
}

export function describeRegime(regime: Regime): string {
  switch (regime.kind) {
    case "outside-cost-rental":
      return "Cost rental tenancy. The national rent control rules do not apply to it.";
    case "outside-ahb":
      return "Approved Housing Body tenancy. The national rent control rules do not apply to it.";
    case "pre-2026-notice":
      return "The rent review notice was served before 1 March 2026, so the rules that applied before that date govern this increase, using HICP rather than CPI.";
    case "market-rent-path":
      return "The landlord is entitled to set market rent here, so no percentage or index cap applies. The only limit is that the rent may not exceed the market rent.";
    case "cpi-only":
      return "A new apartment complex or student specific accommodation whose building control commencement notice was given on or after 10 June 2025. The 2 per cent cap does not apply, only the CPI cap.";
    case "capped":
      return "An ordinary tenancy under national rent control. Both the 2 per cent cap and the CPI cap apply, and the lower one is the limit.";
    case "undetermined-new-build":
      return "Whether the 2 per cent cap applies depends on the building's control commencement notice date, which has not been given.";
    default:
      return assertNever(regime, "describeRegime");
  }
}
