# 00. Documentation index

**Project:** Tenant
**What it is:** A dated rules engine for Irish rent control, behind a site that tells a
tenant whether their rent is lawful and whether the notice asking for it is valid.
**Author:** Nathan Alvares · **Date:** 6 September 2026 · **Status:** research complete, no code yet

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
| 02 | PDD | What we are building and what we are deliberately not building | Sprint 0 |
| 03 | Requirements | What exactly it must do and how we will know | Sprint 0 |
| 04 | HLD | Package boundaries, the request path, where the engine runs | Sprint 1 |
| 05 | LLD | Rule set schema, the determination type, the audit trail format | Sprint 1 |
| 09 | Test and eval plan | Golden vectors, property tests, the differential harness | Sprint 2 |
| 11 | Interview pitch | How to explain it, demo it and defend it | Sprint 7 |
| 12 | Reality check | Written during the build. Where the design was wrong | Sprint 7 |
| 13 | Security and privacy | Threat model, what is enforced by a test, what is not done | Sprint 4 |
| 14 | Running it | Every command in order, and what each should print | Sprint 4 |

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
