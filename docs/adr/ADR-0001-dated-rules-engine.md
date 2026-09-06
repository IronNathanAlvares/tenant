# ADR-0001. The rules are dated data, not code

**Status:** accepted
**Date:** 6 September 2026

## Context

Seven regimes are live in Ireland at once. Private tenancies started before 1 March 2026,
private tenancies started after, new apartments with a commencement notice on or after 10
June 2025, student specific accommodation, new SSA, Approved Housing Body and cost rental
tenancies which are outside the system, and section 19(6) notices served before 1 March
2026 which are still governed by the repealed HICP regime.

The last one is the decisive fact. Section 19(6) of the 2004 Act says that where a
section 22(2) notice was served before 1 March 2026, section 19 applies to that rent as
if section 8 of the 2026 Act had not been enacted. The old law is not history. It is live
law for a shrinking but real set of tenancies, and there is no cut-off date after which
it stops mattering.

This Act will also be amended again. Irish housing legislation has changed materially in
2021, 2022, 2024, 2025 and 2026.

## Decision

The engine takes an explicit `asOf` date and evaluates against a versioned rule set
selected by that date. Rules live as data with validity intervals. Adding a future
amendment means adding a rule version with a commencement date, not editing a function.

Every determination records which rule set version produced it.

## Consequences

**Good.** A question about a January 2026 notice gets the January 2026 answer. When the
law changes, past determinations stay reproducible. The rule set is reviewable by someone
who reads law but not TypeScript, because it is a table rather than a call graph.

**Costs.** More machinery than a calculator needs on day one. Every rule needs a
commencement date sourced from a commencement order or the Act itself, which is real
research work, and getting one wrong is a silent error. The regime resolver becomes the
most important and most testable piece in the system.

**Rejected alternative.** A single function implementing today's law, with the old regime
bolted on as a branch. Faster to write, and it is what every existing tool did. It cannot
answer question 1 above, and it makes the next amendment a rewrite rather than a row.
