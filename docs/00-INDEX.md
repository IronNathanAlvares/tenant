# 00. Documentation index

**Project:** Tenant
**What it is:** A dated rules engine for Irish rent control, behind a site that tells a
tenant whether their rent is lawful and whether the notice asking for it is valid.
**Author:** Nathan Alvares · **Date:** 6 September 2026 · **Status:** Sprint 0 complete, engine not started

> **Standalone project.** No dependency on anything else. Nothing else needs to exist for
> it to run.

---

## Reading orders

**Five minutes:** [`README.md`](../README.md).

**To understand why it is built this way:**
[`01-research-and-analysis.md`](01-research-and-analysis.md) §2 and §3, then the decision
records below.

**To build it:** [`SPRINTS.md`](../SPRINTS.md), then
[`01-research-and-analysis.md`](01-research-and-analysis.md) in full.

**If you only care about the law:** [`01-research-and-analysis.md`](01-research-and-analysis.md)
§1 to §5.

---

## Documents

| # | Document | Answers | State |
|---|---|---|---|
| 01 | [Research and analysis](01-research-and-analysis.md) | What the law actually says, where the data is, what already exists and why it is wrong | Written |
| 02 | PDD | What we are building and what we are deliberately not building | Sprint 1 |
| 03 | Requirements | What exactly it must do and how we will know | Sprint 1 |
| 04 | HLD | Package boundaries, the request path, where the engine runs | Sprint 1 |
| 05 | LLD | Rule set schema, the determination type, the audit trail format | Sprint 1 |
| 09 | Test and eval plan | Golden vectors, property tests, the differential harness | Sprint 2 |
| 11 | Interview pitch | How to explain it, demo it and defend it | Sprint 7 |
| 12 | Reality check | Written during the build. Where the design was wrong | Sprint 7 |
| 13 | Security and privacy | Threat model, what is enforced by a test, what is not done | Sprint 4 |
| 14 | Running it | Every command in order, and what each should print | Sprint 4 |

## Measurements

| # | Document | What it found |
|---|---|---|
| [01](measurements/01-rtb-calculator-algorithm.md) | The RTB Rent Calculator algorithm | The official calculation is client-side and readable. It diverges from section 19(4) on the CPI reference month and on pro-rating by whole months. Closed three open questions and corrected the worked example |
| [02](measurements/02-engine-agreement.md) | Agreement with the RTB calculator | 2,720 of 2,720 exact. And the two readings of section 19(4) differ by a median of 4.05 euro a month, up to 173.36, which disproved ADR-0006 |

Numbering matches the convention used in `03-leafline`. Gaps are intentional and get
filled in the sprint named.

## Decision records

| ADR | Decision | Why it matters |
|---|---|---|
| [0001](adr/ADR-0001-dated-rules-engine.md) | Rules are dated data, not code | Section 19(6) keeps the repealed HICP regime alive for notices served before 1 March 2026 |
| [0002](adr/ADR-0002-model-explains-never-computes.md) | The model explains, never computes | Output may reach an RTB adjudicator. Enforced by an assertion, not a prompt |
| [0003](adr/ADR-0003-pinned-cpi-snapshots.md) | CPI is a pinned snapshot, not a live call | Reproducibility, and the statute points at the RTB's table rather than the CSO's |
| [0004](adr/ADR-0004-user-initiated-fetch-not-crawl.md) | Fetch one page for one user, never crawl | robots.txt and terms, and RTB published data is the better baseline anyway |
| [0005](adr/ADR-0005-typescript-and-a-pure-engine.md) | TypeScript, engine is pure | One implementation, runs in the browser, so rent and address never leave the device |
| [0006](adr/ADR-0006-follow-the-calculator-show-the-statute.md) | Follow the RTB calculator, show the statutory figure too | The official tool diverges from section 19(4) in two places, and the landlord's notice will carry its number |
| [0007](adr/ADR-0007-no-third-party-scripts-on-the-calculation-pages.md) | No third-party scripts on the calculation pages | Sentry and analytics would break the privacy claim, and the test that enforces it |
| [0008](adr/ADR-0008-the-model-does-not-run-at-request-time.md) | The model does not run at request time | A determination contains someone's rent. Explaining it to a model means sending it. Supersedes the runtime half of ADR-0002 |

---

## The claims this project will make

Each of these has to be defended by a document or a measurement before it goes in the
README as fact. None of them are proven yet.

| Claim | Will be defended in |
|---|---|
| The percentage cap is simple, not compound | `01` §2, and a golden vector in `09` |
| The CPI reference month is asymmetric across 1 March 2026 | `01` §2, and a golden vector in `09` |
| Seven regimes run in parallel | `01` §3 and §4 |
| Our engine agrees with the official RTB calculator on X of N cases | Sprint 2 measurement |
| The model cannot introduce a number into the output | ADR-0002, asserted by a test |
| A determination is byte-reproducible from inputs plus a snapshot hash | ADR-0003, asserted by a test |
| Rent and address never reach a server for the basic check | ADR-0005, asserted by a network test |
