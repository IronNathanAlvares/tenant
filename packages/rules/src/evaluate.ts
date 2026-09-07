/**
 * The engine.
 *
 * A pure function from a query plus a CPI snapshot to a determination. No I/O, no clock,
 * no environment, no randomness. R-OUT-05.
 *
 * Section 19(4)(a) of the Residential Tenancies Act 2004 as amended imposes two
 * constraints, and the new rent must satisfy both. Constraint A caps the increase at 2 per
 * cent of the old rent per year elapsed. Constraint B caps the ratio of new rent to old
 * rent at the ratio of the current CPI number to the previous. The binding one is
 * whichever is lower, which is not always the same one. R-CAP-01.
 *
 * Everything is computed twice, on the RTB's basis and on the statutory basis, because
 * those two disagree and the determination reports both. ADR-0006.
 */

import { CITATIONS, type Citation } from "./citations";
import {
  type CpiBasis,
  type CpiReading,
  type CpiSnapshot,
  cpiChangePercent,
  currentCpiNumber,
  previousCpiNumber,
} from "./cpi";
import {
  compareDates,
  formatDate,
  monthLabel,
  wholeMonthsBetween,
  yearsAndRemainder,
} from "./dates";
import { type Cents, cents, formatEuro } from "./money";
import { describeRegime, type Regime, resolveRegime } from "./regime";
import {
  type AuditStep,
  assertNever,
  type Calculation,
  type Constraint,
  type Determination,
  type Provenance,
  type RentQuery,
} from "./types";

/** Bumped whenever the encoded rules change. Recorded on every determination. R-OUT-03. */
export const RULES_VERSION = "1.0.0";

const TWO_PERCENT = 2;

function provenanceOf(snapshot: CpiSnapshot): Provenance {
  return {
    rulesVersion: RULES_VERSION,
    cpiSnapshotSha256: snapshot.sha256,
    cpiLatestMonth: snapshot.latestMonth,
    cpiBase: snapshot.base,
  };
}

/**
 * Round half up to the nearest cent.
 *
 * `Math.round` in JavaScript rounds half toward positive infinity, which for the
 * non-negative amounts we deal with is half up, and it is what the RTB calculator does.
 * The multiplication happens once, on an integer cent amount, so the only float in the
 * chain is the percentage itself. R-MONEY-04.
 */
function applyPercent(base: Cents, percent: number): Cents {
  return cents(Math.round(base * (1 + percent / 100)));
}

/**
 * Constraint A, the percentage cap. Section 19(4)(b).
 *
 * "2 per cent of the old rent in respect of each year that has elapsed since the previous
 * setting, and as respects any additional period ... shorter than a year, such percentage
 * as bears to 2 per cent the same proportion that that period bears to a year."
 *
 * Two things people get wrong. It is 2 per cent **of the old rent** per year, so it is
 * simple and not compound: three years is 6 per cent, not 6.12. And the part year is
 * pro-rated, so a review at 15 months allows 2.5 per cent rather than 2. R-CAP-02.
 *
 * The Act does not say how to measure a proportion of a year. The RTB's calculator uses
 * whole months. Read literally the wording suggests days. Both are computed. R-CAP-03.
 */
function percentageCap(query: RentQuery, basis: CpiBasis): Constraint {
  if (basis === "rtb") {
    const months = Math.max(0, wholeMonthsBetween(query.previousSetting, query.newSetting));
    return {
      name: "percentage",
      percent: TWO_PERCENT * (months / 12),
      explanation: `${months} whole month${months === 1 ? "" : "s"} elapsed, so 2% x ${months}/12`,
      citation: CITATIONS.percentageCap,
    };
  }

  const { years, remainderDays, daysInRemainderYear } = yearsAndRemainder(
    query.previousSetting,
    query.newSetting,
  );
  const fraction = daysInRemainderYear === 0 ? 0 : remainderDays / daysInRemainderYear;
  const parts = [`2% x ${years} year${years === 1 ? "" : "s"}`];
  if (remainderDays > 0) {
    parts.push(`2% x ${remainderDays}/${daysInRemainderYear} of a further year`);
  }
  return {
    name: "percentage",
    percent: TWO_PERCENT * years + TWO_PERCENT * fraction,
    explanation: parts.join(", plus "),
    citation: CITATIONS.percentageCap,
  };
}

/** Constraint B, the index cap. Section 19(4)(a)(ii). R-CAP-04. */
function indexCap(previous: CpiReading, current: CpiReading): Constraint {
  const percent = cpiChangePercent(previous, current);
  return {
    name: "index",
    percent,
    explanation: `CPI ${monthLabel(previous.month)} ${previous.value} to ${monthLabel(
      current.month,
    )} ${current.value}`,
    citation: CITATIONS.cpiDefinitions,
  };
}

function calculate(
  query: RentQuery,
  snapshot: CpiSnapshot,
  basis: CpiBasis,
  applyPercentageCap: boolean,
): Calculation {
  const previousCpi = previousCpiNumber(snapshot, query.previousSetting, basis);
  const currentCpi = currentCpiNumber(snapshot, query.newSetting, basis);

  const pctCap = applyPercentageCap ? percentageCap(query, basis) : null;
  const idxCap =
    previousCpi !== null && currentCpi !== null ? indexCap(previousCpi, currentCpi) : null;

  const candidates: Constraint[] = [];
  if (pctCap !== null) candidates.push(pctCap);
  if (idxCap !== null) candidates.push(idxCap);

  // Where the CPI cap cannot be computed because the snapshot does not reach, fall back to
  // the percentage cap alone rather than inventing an index figure. Where neither can be
  // computed the applied percentage is zero, which is the conservative direction: it
  // reports no lawful increase rather than an unbounded one.
  let binding: Constraint | null = null;
  for (const candidate of candidates) {
    if (binding === null || candidate.percent < binding.percent) {
      binding = candidate;
    }
  }

  const appliedPercent = binding?.percent ?? 0;
  const maxRent = applyPercent(query.previousRent, appliedPercent);
  const maxIncrease = cents(Math.max(0, maxRent - query.previousRent));

  return {
    basis,
    percentageCap: pctCap,
    indexCap: idxCap,
    bindingConstraint: binding?.name ?? null,
    appliedPercent,
    maxRent,
    maxIncrease,
    previousCpi,
    currentCpi,
  };
}

function auditFor(
  query: RentQuery,
  regime: Regime,
  headline: Calculation,
  statutory: Calculation,
): AuditStep[] {
  const steps: AuditStep[] = [
    {
      label: "Which rules apply",
      detail: describeRegime(regime),
      citation: "citation" in regime ? regime.citation : CITATIONS.capApplies,
    },
    {
      label: "Rent last set",
      detail: `${formatEuro(query.previousRent)} on ${formatDate(query.previousSetting)}`,
      value: formatEuro(query.previousRent),
    },
    {
      label: "New rent being set",
      detail: `On ${formatDate(query.newSetting)}`,
    },
  ];

  if (headline.percentageCap !== null) {
    steps.push({
      label: "Percentage cap",
      detail: headline.percentageCap.explanation,
      value: `${headline.percentageCap.percent.toFixed(4)}%`,
      citation: headline.percentageCap.citation,
    });
  } else {
    steps.push({
      label: "Percentage cap",
      detail: "Does not apply to this dwelling, so only the CPI cap limits the increase.",
      citation: CITATIONS.newBuildExemption,
    });
  }

  if (headline.indexCap !== null) {
    steps.push({
      label: "CPI cap",
      detail: headline.indexCap.explanation,
      value: `${headline.indexCap.percent.toFixed(4)}%`,
      citation: headline.indexCap.citation,
    });
  } else {
    steps.push({
      label: "CPI cap",
      detail:
        "Could not be calculated because the published CPI table does not cover one of these dates.",
      citation: CITATIONS.cpiTablePublication,
    });
  }

  steps.push({
    label: "Which cap binds",
    detail:
      headline.bindingConstraint === null
        ? "Neither cap could be calculated."
        : `The ${headline.bindingConstraint === "percentage" ? "percentage" : "CPI"} cap is lower, so it is the limit.`,
    value: `${headline.appliedPercent.toFixed(4)}%`,
    citation: CITATIONS.capApplies,
  });

  steps.push({
    label: "Maximum lawful rent",
    detail: `${formatEuro(query.previousRent)} increased by ${headline.appliedPercent.toFixed(4)}%, rounded to the nearest cent`,
    value: formatEuro(headline.maxRent),
  });

  steps.push({
    label: "Maximum increase",
    detail: "What the RTB Rent Calculator displays, so it is the figure to compare against",
    value: formatEuro(headline.maxIncrease),
  });

  if (headline.maxRent !== statutory.maxRent) {
    steps.push({
      label: "Reading the Act strictly gives a different figure",
      detail:
        "The RTB calculator and the wording of section 19(4) do not agree on which month's CPI to use or how to measure part of a year. The figure above follows the RTB, because that is what a landlord's notice will be based on.",
      value: formatEuro(statutory.maxRent),
      citation: CITATIONS.cpiDefinitions,
    });
  }

  return steps;
}

function collectCitations(steps: readonly AuditStep[], extra: readonly Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const citation of extra) {
    seen.set(`${citation.act}|${citation.provision}`, citation);
  }
  for (const step of steps) {
    if (step.citation !== undefined) {
      seen.set(`${step.citation.act}|${step.citation.provision}`, step.citation);
    }
  }
  return [...seen.values()];
}

/**
 * Evaluate a rent question.
 *
 * Never throws for a well-formed query. Problems come back as a `not-answerable`
 * determination so a caller cannot forget to handle them. R-OUT-06.
 */
export function evaluateRent(query: RentQuery, snapshot: CpiSnapshot): Determination {
  const provenance = provenanceOf(snapshot);

  if (compareDates(query.newSetting, query.previousSetting) <= 0) {
    return {
      outcome: "not-answerable",
      problem: "The new rent date is not after the date the rent was last set",
      detail: `Rent was last set on ${formatDate(query.previousSetting)} and the new rent is dated ${formatDate(
        query.newSetting,
      )}. Check which date is which.`,
      audit: [],
      citations: [],
      provenance,
    };
  }

  if (query.previousRent < 0) {
    return {
      outcome: "not-answerable",
      problem: "The previous rent is negative",
      detail: "A rent cannot be less than zero.",
      audit: [],
      citations: [],
      provenance,
    };
  }

  const regime = resolveRegime(query);

  switch (regime.kind) {
    case "outside-cost-rental":
      return noCap(
        "cost-rental",
        "This is a cost rental tenancy. Part 3 of the Residential Tenancies Act 2004, which contains the rent rules, does not apply to it, so the national 2 per cent and CPI caps do not either. Cost rental rents are set under a separate scheme.",
        regime.citation,
        provenance,
      );

    case "outside-ahb":
      return noCap(
        "approved-housing-body",
        "This is an Approved Housing Body tenancy. The national rent control rules do not apply. Rent is set under the body's own scheme, and the RTB is still the place to raise a dispute.",
        regime.citation,
        provenance,
      );

    case "market-rent-path":
      return noCap(
        "market-rent-path",
        "In this situation the landlord is entitled to set the market rent, so neither the 2 per cent cap nor the CPI cap limits the increase. The one limit that still applies is that the rent may not be above the market rent for a comparable dwelling.",
        regime.citation,
        provenance,
      );

    case "pre-2026-notice":
      return {
        outcome: "not-answerable",
        problem: "This notice is governed by the rules that applied before 1 March 2026",
        detail:
          "Section 19(6) keeps the previous regime alive for any rent review notice served before 1 March 2026, and that regime used HICP rather than CPI. This calculator does not yet cover it. Contact Threshold on 1800 454 454.",
        audit: [
          {
            label: "Which rules apply",
            detail: describeRegime(regime),
            citation: regime.citation,
          },
        ],
        citations: [regime.citation],
        provenance,
      };

    case "undetermined-new-build": {
      // The answer turns on a building control commencement notice date the tenant cannot
      // see. Compute both branches and hand back the question rather than guessing.
      const exemptQuery: RentQuery = { ...query, newBuildExemption: "yes" };
      const notExemptQuery: RentQuery = { ...query, newBuildExemption: "no" };
      const audit: AuditStep[] = [
        {
          label: "One fact is missing",
          detail: describeRegime(regime),
          citation: CITATIONS.newBuildExemption,
        },
      ];
      return {
        outcome: "unknown",
        question:
          "Is this dwelling in an apartment complex or student specific accommodation whose building control commencement notice was given on or after 10 June 2025?",
        howToFindOut:
          "Ask the landlord directly. They must be able to produce the commencement notice or 7 day notice if the RTB investigates, so it is a fair question to put in writing. A building finished well before mid 2025 will not qualify.",
        branches: [
          {
            answer: "Yes, it qualifies. Only the CPI cap applies.",
            determination: evaluateRent(exemptQuery, snapshot),
          },
          {
            answer: "No, it does not qualify. Both caps apply.",
            determination: evaluateRent(notExemptQuery, snapshot),
          },
        ],
        audit,
        citations: collectCitations(audit, [CITATIONS.newBuildExemption, CITATIONS.capApplies]),
        provenance,
      };
    }

    case "capped":
    case "cpi-only": {
      const applyPercentageCap = regime.kind === "capped";
      const headline = calculate(query, snapshot, "rtb", applyPercentageCap);
      const statutory = calculate(query, snapshot, "statute", applyPercentageCap);
      const audit = auditFor(query, regime, headline, statutory);
      const proposedIsLawful =
        query.proposedRent === undefined ? null : query.proposedRent <= headline.maxRent;

      return {
        outcome: "capped",
        headline,
        statutory,
        basesAgree: headline.maxRent === statutory.maxRent,
        proposedIsLawful,
        audit,
        citations: collectCitations(audit, [regime.citation, CITATIONS.marketRentProhibition]),
        provenance,
      };
    }

    default:
      return assertNever(regime, "evaluateRent");
  }
}

function noCap(
  reason: "cost-rental" | "approved-housing-body" | "market-rent-path",
  explanation: string,
  citation: Citation,
  provenance: Provenance,
): Determination {
  const audit: AuditStep[] = [{ label: "Which rules apply", detail: explanation, citation }];
  return {
    outcome: "no-cap",
    reason,
    explanation,
    audit,
    citations: collectCitations(audit, [citation, CITATIONS.marketRentProhibition]),
    provenance,
  };
}
