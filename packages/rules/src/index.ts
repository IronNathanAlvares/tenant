/**
 * @tenant/rules
 *
 * A pure evaluation of Irish rent control. No I/O, no clock, no network, no
 * environment access. Time enters as an explicit `asOf` parameter and CPI enters as an
 * injected snapshot, so a determination is reproducible from its inputs alone.
 *
 * See docs/adr/ADR-0005-typescript-and-a-pure-engine.md.
 */

export { CITATIONS, type Citation, type CitationKey } from "./citations";
export {
  type CpiBasis,
  type CpiReading,
  type CpiSnapshot,
  cpiChangePercent,
  currentCpiNumber,
  HICP_REGIME_START,
  lookupCpi,
  NATIONAL_RENT_CONTROL_START,
  NEW_BUILD_EXEMPTION_START,
  previousCpiNumber,
  previousHicpNumber,
  previousIndexNumber,
  WHOLE_STATE_DEEMED_RPZ,
} from "./cpi";
export {
  addMonths,
  addYears,
  compareDates,
  compareMonths,
  daysBetween,
  daysInMonth,
  formatDate,
  formatMonth,
  isLeapYear,
  monthLabel,
  monthOf,
  type PlainDate,
  type PlainMonth,
  parseDate,
  parseMonth,
  previousMonth,
  toDayNumber,
  wholeMonthsBetween,
  yearsAndRemainder,
} from "./dates";
export { evaluateRent, RULES_VERSION } from "./evaluate";
export {
  addCents,
  type Cents,
  cents,
  formatEuro,
  formatEuroDisplay,
  parseEuro,
  subtractCents,
} from "./money";
export {
  type Answer,
  assessNotice,
  type Defect,
  DISPUTE_WINDOW_DAYS,
  type DisputeDeadline,
  disputeDeadline,
  NOTICE_PERIOD_DAYS,
  type NotAssessed,
  type NoticeAssessment,
  type NoticeContents,
  type NoticeQuery,
  type Severity,
  severityRank,
} from "./notice";
export {
  buildPack,
  type DisputePack,
  deadlineSentence,
  type LetterOptions,
  landlordLetter,
  longDate,
  type PlainSummary,
  summariseNotice,
  summariseRent,
} from "./pack";
export {
  describeRegime,
  isBeforeCommencement,
  percentageCapApplies,
  type Regime,
  resolveRegime,
} from "./regime";
export {
  type AuditStep,
  assertNever,
  type Calculation,
  type Constraint,
  type Determination,
  type NewBuildExemption,
  type NoCapReason,
  type Outcome,
  type Provenance,
  type RentQuery,
  type TenancyKind,
} from "./types";
