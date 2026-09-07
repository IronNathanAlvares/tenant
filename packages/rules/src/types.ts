/**
 * The shapes the engine speaks in.
 *
 * The important one is `Determination`. It is a discriminated union in which "I do not
 * know" is a full member with the same standing as an answer, not an error. The new build
 * carve-out at section 19(4)(aa) turns on a building control commencement notice date that
 * a tenant cannot look up, so for a large class of real queries the honest output is two
 * answers and a question. R-REG-05, PDD §6.
 */

import type { Citation } from "./citations";
import type { CpiReading } from "./cpi";
import type { PlainDate } from "./dates";
import type { Cents } from "./money";

/** What kind of letting this is. Decides whether rent control applies at all. */
export type TenancyKind =
  | "private"
  | "student-specific-accommodation"
  | "approved-housing-body"
  | "cost-rental";

/**
 * Whether the dwelling qualifies for the section 19(4)(aa) exemption from the 2 per cent
 * cap. `"unknown"` is the common case: it depends on a building control commencement
 * notice date the tenant has no way to see.
 */
export type NewBuildExemption = "yes" | "no" | "unknown";

export interface RentQuery {
  readonly tenancyKind: TenancyKind;
  /** When the tenancy began. Decides which security-of-tenure and frequency regime applies. */
  readonly tenancyStart?: PlainDate;
  /** When the rent was last set, whether at the start of the tenancy or at a review. */
  readonly previousSetting: PlainDate;
  /** The rent set at that previous setting. */
  readonly previousRent: Cents;
  /** When the new rent is being set. */
  readonly newSetting: PlainDate;
  /** The rent the landlord is proposing, if the tenant knows it. */
  readonly proposedRent?: Cents;
  /** When the rent review notice was served, if there was one. Decides s. 19(6). */
  readonly noticeServed?: PlainDate;
  readonly newBuildExemption: NewBuildExemption;
  /**
   * True where the landlord is entitled to set market rent under s. 19(5), for example at
   * the end of a six year tenancy of minimum duration or after a two year vacancy.
   */
  readonly marketRentPathApplies?: boolean;
  /** Evaluated as at this date. Never read from a clock. R-DATE-02. */
  readonly asOf: PlainDate;
}

/** One checkable step. A person with a calculator can follow these and get the same answer. */
export interface AuditStep {
  readonly label: string;
  readonly detail: string;
  readonly value?: string;
  readonly citation?: Citation;
}

/** One of the two caps in section 19(4)(a), evaluated. */
export interface Constraint {
  readonly name: "percentage" | "index";
  readonly percent: number;
  readonly explanation: string;
  readonly citation: Citation;
}

/** A complete calculation on one basis. ADR-0006 means we produce two of these. */
export interface Calculation {
  readonly basis: "rtb" | "statute";
  readonly percentageCap: Constraint | null;
  readonly indexCap: Constraint | null;
  readonly bindingConstraint: "percentage" | "index" | null;
  readonly appliedPercent: number;
  readonly maxRent: Cents;
  readonly maxIncrease: Cents;
  readonly previousCpi: CpiReading | null;
  readonly currentCpi: CpiReading | null;
}

export interface Provenance {
  readonly rulesVersion: string;
  readonly cpiSnapshotSha256: string;
  readonly cpiLatestMonth: string;
  readonly cpiBase: string;
}

/** Named so the interface can special-case each without string matching. */
export type NoCapReason = "cost-rental" | "approved-housing-body" | "market-rent-path";

export type Determination =
  /** The cap applies and here is the maximum. */
  | {
      readonly outcome: "capped";
      readonly headline: Calculation;
      readonly statutory: Calculation;
      readonly basesAgree: boolean;
      readonly proposedIsLawful: boolean | null;
      readonly audit: readonly AuditStep[];
      readonly citations: readonly Citation[];
      readonly provenance: Provenance;
    }
  /** No cap applies. There is no maximum to give, only the market rent prohibition. */
  | {
      readonly outcome: "no-cap";
      readonly reason: NoCapReason;
      readonly explanation: string;
      readonly audit: readonly AuditStep[];
      readonly citations: readonly Citation[];
      readonly provenance: Provenance;
    }
  /**
   * The answer depends on a fact the tenant cannot verify. Both branches are given, with
   * the question that separates them and how to answer it. R-REG-05.
   */
  | {
      readonly outcome: "unknown";
      readonly question: string;
      readonly howToFindOut: string;
      readonly branches: readonly {
        readonly answer: string;
        readonly determination: Determination;
      }[];
      readonly audit: readonly AuditStep[];
      readonly citations: readonly Citation[];
      readonly provenance: Provenance;
    }
  /**
   * The question as asked cannot be answered. A value, not an exception, so callers cannot
   * forget to handle it. R-OUT-06.
   */
  | {
      readonly outcome: "not-answerable";
      readonly problem: string;
      readonly detail: string;
      readonly audit: readonly AuditStep[];
      readonly citations: readonly Citation[];
      readonly provenance: Provenance;
    };

export type Outcome = Determination["outcome"];

/**
 * Compile-time exhaustiveness. Passing a value here is only legal when the type has been
 * narrowed to `never`, so adding a regime or an outcome without handling it everywhere is
 * a type error rather than a silent fallthrough. R-REG-08.
 */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled case in ${context}: ${JSON.stringify(value)}`);
}
