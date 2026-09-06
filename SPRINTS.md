# Tenant, sprint plan

**Read this first if you are picking the project back up.** It is the working document.
Tick things off as they land. If a sprint slips, move the task, do not silently drop it.

**Rule for every sprint:** a sprint ends with something that runs and a number that is
measured, not a folder of half-written code. If a sprint cannot end that way, it is too
big and should be split.

**Status key:** `todo` / `doing` / `done` / `blocked` / `dropped`

---

## The shape of the thing

Four product surfaces, built in this order. Surfaces 1 to 3 are one coherent product and
ship together. Surface 4 is the second half and ships later.

| # | Surface | What the visitor does | Ships in |
|---|---|---|---|
| 1 | **Rent check** | Enters rent, dates and tenancy type. Gets the maximum lawful rent, whether the proposed one is lawful, and the calculation shown step by step with the provision cited | S4 |
| 2 | **Notice check** | Answers six questions about how the notice arrived. Gets a list of specific defects, each citing a rule | S4 |
| 3 | **What now** | Gets a printable pack: the calculation, the defects, a letter to the landlord, and where to go next | S5 |
| 4 | **Listing check** | Pastes a rental advert. Gets scam signals and a rent plausibility check against RTB data | Deferred, not in v1 |

**Scope decision, 6 September 2026.** Surface 4 is cut from the first release. Surfaces 1
to 3 are a complete product on their own, and the listing checker is the one part with no
honest way to measure itself yet. Sprint 6 stays written down so the reasoning survives,
but it does not block shipping. See ADR-0004 for why there is no labelled corpus.

**Working cadence.** One sprint per session, reviewed before the next starts. A sprint that
cannot end with something running and something measured gets split rather than rushed.

---

## Sprint 0. Foundations and the rest of the research

**Goal:** every open question closed, the repo exists, CI is green on an empty project.
**Ends with:** `pnpm test` passing in CI on a repo with no features yet.

| # | Task | Status |
|---|---|---|
| 0.1 | Create the GitHub repo, push the scaffold | **done** |
| 0.2 | pnpm workspace, TypeScript strict, Vitest, Biome, tsconfig project refs | **done** |
| 0.3 | GitHub Actions: typecheck, lint, test, build. No warnings tolerated | **done** |
| 0.4 | Close open question 1: limitation period for disputing a rent review | **done.** Section 22(3). Doc 01 §8a |
| 0.5 | Close open question 2: is the RTB CPI table machine readable | **done.** It reads CSO CPM24C01 client side and its values reconcile exactly with our snapshot |
| 0.6 | Close open question 3: current RTB dispute fees, verbatim from rtb.ie | **partly.** Mediation free, adjudication 30 euro from Citizens Information. Not read off the RTB fees page itself |
| 0.7 | Properly review righttenantry.ie, propdesk.ie, tenantsync.ie | **not done.** Carried to Sprint 2 |
| 0.8 | Read section 22 of RTA 2004 in full | **done.** Full checklist in doc 01 §5a |
| 0.9 | Read the pre-2026 HICP regime for the section 19(6) path | **done.** Same two-constraint shape with HICP. RTA(A) 2025 deemed the whole State an RPZ from 20 June 2025, so geography stops mattering after that date |
| 0.10 | Write `docs/02-PDD.md`, `docs/03-requirements.md` | **not done.** Carried to Sprint 1 |
| 0.11 | Create the Vercel project, connect it to the GitHub repo | **done** by Nathan |
| 0.12 | Minimal `apps/web` that actually deploys, so the Vercel path is proven now rather than in Sprint 4 | **done.** Added mid-sprint after the deployment 404'd |
| 0.13 | CPI freshness check that fails the build when the CSO publishes a month we do not have | **done.** `scripts/check_cpi_freshness.py`, wired into CI |

### What Sprint 0 actually found

Reading the RTB Rent Calculator turned out to be the whole story. Its calculation runs
client side, so the official algorithm could be read rather than probed, which closed
three open questions early and turned up two places where the official implementation does
not match section 19(4). Written up in
[`docs/measurements/01`](docs/measurements/01-rtb-calculator-algorithm.md), decided in
[`ADR-0006`](docs/adr/ADR-0006-follow-the-calculator-show-the-statute.md).

That correction moved the README's worked example from 2,050.08 to 2,050.00.

One new open question came out of it, number 7 in doc 01 §10: whether the 24 month review
frequency still bites for tenancies that started before 1 March 2026. My reading of section
20(4) to (6) with the new section 20B says it does until 20 June 2027. The RTB says
otherwise. That one needs a solicitor, not more reading.

---

## Sprint 1. The rules engine

**Goal:** a pure TypeScript function that takes a rent question and an as-of date and
returns a determination with a full audit trail.
**Ends with:** the worked example in doc 01 §2 computed correctly by code, plus the
regime matrix covered by tests.

| # | Task | Status |
|---|---|---|
| 1.0 | Carried from Sprint 0: write `docs/02-PDD.md` and `docs/03-requirements.md` | todo |
| 1.1 | `packages/rules`: types for `RentQuery`, `Determination`, `AuditStep`, `Citation` | todo |
| 1.2 | CPI ingest script: CSO CPM24 JSON-stat to a flat `{ month, value }` snapshot with a content hash | todo |
| 1.3 | CPI lookup with the publication-lag fallback, both the current and previous variants | todo |
| 1.4 | Regime resolver: given tenancy facts and a date, return which of the seven regimes applies | todo |
| 1.5 | Constraint A, relevant percentage. Simple not compound, whole years plus pro-rated remainder | todo |
| 1.6 | Constraint B, index ratio, with the pre/post 1 March 2026 reference month asymmetry | todo |
| 1.7 | Section 19(5) market rent paths, returning "no cap applies" with the reason | todo |
| 1.8 | Section 19(6) in-flight notice path, routing to the HICP regime | todo |
| 1.9 | Every branch returns a `Citation` with Act, section, subsection and a URL | todo |
| 1.10 | Audit trail: an ordered list of steps a human can check by hand | todo |
| 1.11 | `Unknown` as a first-class result when an input the tool cannot verify decides the answer | todo |

**The hard part is 1.11.** The new-build carve-out turns on a commencement notice date
the tenant cannot see. The engine must be able to return "the answer is X if the building
commenced before 10 June 2025 and Y if after, and here is how to find out", rather than
picking one.

---

## Sprint 2. Ground truth and the headline number

**Goal:** the metric the project is judged on.
**Ends with:** a published match rate against the official RTB calculator, and the
rounding and day-count conventions settled by evidence rather than guess.

| # | Task | Status |
|---|---|---|
| 2.1 | ~~Work out whether the RTB calculator is drivable~~ **Done in Sprint 0.** It is client-side JS and was read directly | done |
| 2.2 | Port the RTB algorithm as a **reference oracle** in the test suite, from `measurements/01`, kept separate from our engine | todo |
| 2.3 | Randomised differential testing of our engine against the oracle, large N | todo |
| 2.4 | Drive the real form on a small stratified sample to prove the oracle is faithful. This is the step that keeps the whole thing honest | todo |
| 2.5 | Golden vector file in `data/vectors` with provenance per row, and the published match rate | todo |
| 2.6 | Carried from Sprint 0: review righttenantry.ie, propdesk.ie, tenantsync.ie properly | todo |
| 2.7 | Property tests with fast-check: monotonic in old rent, never exceeds either cap, stable under date reordering | todo |
| 2.8 | Write `docs/measurements/02-engine-agreement.md`, including every case we do not match and why | todo |

**Report the failures.** A match rate of 100 per cent on 12 easy cases is worth less than
97 per cent on 400 with the three failures explained. If we disagree with the RTB
calculator and we are right, that is a finding and it goes in the README.

---

## Sprint 3. Notice validity

**Goal:** Surface 2.
**Ends with:** a defect list for a set of hand-built notice scenarios.

| # | Task | Status |
|---|---|---|
| 3.1 | `packages/rules/notice`: `NoticeQuery` and `Defect` types, each defect citing a rule | todo |
| 3.2 | 90 day rule, counted from service to the date the new rent takes effect | todo |
| 3.3 | Same-day RTB filing rule, only for notices served on or after 1 March 2026 | todo |
| 3.4 | 12 month frequency rule, section 20 as amended by section 9 of the 2026 Act | todo |
| 3.5 | Required attachments: calculator printout, or register printout with three comparables | todo |
| 3.6 | Correct form used, and rent details updated on the register within one month | todo |
| 3.7 | Severity model: which defects void the notice and which are breaches without voiding it | todo |
| 3.8 | Scenario tests, one per defect plus combinations | todo |

**3.7 needs care.** Not every breach voids a notice. Saying "your notice is invalid" when
it is merely irregular sends someone into a dispute they lose. If the law is unclear on a
given defect, say it is unclear.

---

## Sprint 4. The web app, v1

**Goal:** a live URL a stranger can use with no account.
**Ends with:** deployed, on the real domain, with Surfaces 1 and 2 working.

| # | Task | Status |
|---|---|---|
| 4.1 | Next.js app, App Router, on Vercel | todo |
| 4.2 | The engine runs client side. No rent or address is sent to the server for the basic check | todo |
| 4.3 | Rent check form. Progressive: three questions first, more only if the answer needs them | todo |
| 4.4 | Result view: the verdict, the maximum, the calculation shown step by step, the citation | todo |
| 4.5 | Notice check flow | todo |
| 4.6 | The boundary statement in the interface, above the fold, not in the footer | todo |
| 4.7 | Accessibility: keyboard path, screen reader, contrast. Tested, not assumed | todo |
| 4.8 | Mobile first. Most of this traffic will be someone on a phone in a kitchen | todo |
| 4.9 | Sentry, and privacy-respecting analytics with no rent values in any event | todo |
| 4.10 | Static CPI snapshot shipped with the bundle, its version and date shown on the result | todo |

**4.2 is the design commitment.** It is what lets the site say "we never see your rent",
and it is only free if Sprint 1 kept the engine pure.

---

## Sprint 5. Explanation and the dispute pack

**Goal:** Surface 3, and the model finally appears.
**Ends with:** a downloadable PDF pack a tenant could hand to the RTB.

| # | Task | Status |
|---|---|---|
| 5.1 | Explanation layer. The model receives the finished determination and writes prose about it. It never computes and never sees a form it could compute from | todo |
| 5.2 | Guard: assert every number in the generated text appears in the determination. Refuse to render if not | todo |
| 5.3 | Fallback to a deterministic template when the model is unavailable or the guard trips | todo |
| 5.4 | PDF pack: inputs, determination, audit trail, citations, CPI snapshot version, timestamp | todo |
| 5.5 | Letter to the landlord, generated, editable before download | todo |
| 5.6 | Next steps: mediation, adjudication, fees, Threshold, with the limitation period from task 0.4 | todo |
| 5.7 | Plain English pass on all output. Reading age target, measured | todo |

**5.2 is the whole safety argument.** The model paraphrases a number it was given. If a
number appears in the prose that is not in the determination, the render fails. That is
an assertion in code, not a prompt instruction.

---

## Sprint 6. Listing check (deferred, not in v1)

**Goal:** Surface 4.
**Ends with:** a signal-based checker that is honest about its confidence.

Cut from the first release on 6 September 2026. Kept here because the design work is
sound and the reasoning is worth preserving. Revisit once Surfaces 1 to 3 have real users,
or if a labelled dataset becomes obtainable.

| # | Task | Status |
|---|---|---|
| 6.1 | Paste text or URL. Single page fetch on the user's behalf, never a crawl | todo |
| 6.2 | Extract: rent, location, bedrooms, property type, contact method, images | todo |
| 6.3 | Ingest RTB Rent Index by LEA into a lookup table | todo |
| 6.4 | Plausibility: is this rent far below the LEA distribution for that size and type | todo |
| 6.5 | Rule-based scam signals: deposit before viewing, off-platform contact, landlord abroad, pressure language, no viewing offered | todo |
| 6.6 | Reverse image search on listing photos where feasible | todo |
| 6.7 | Output is signals with reasons, not a score. "Three things here look wrong and here is why" | todo |
| 6.8 | Build a small labelled set honestly, or state plainly that there is no measured precision yet | todo |

**6.8 is where this could go wrong.** Claiming a precision figure without a real labelled
set would undo the credibility the rest of the project buys. If there is no labelled set,
the README says so.

---

## Sprint 7. Ship it

**Goal:** real users.

| # | Task | Status |
|---|---|---|
| 7.1 | Live on the Vercel URL, HTTPS, security headers, sane CSP. Custom domain optional | todo |
| 7.2 | Lighthouse and axe pass. Real device testing | todo |
| 7.3 | Three minute demo recording | todo |
| 7.4 | `docs/12-reality-check.md`: everywhere the design was wrong during the build | todo |
| 7.5 | `docs/11-interview-pitch.md` | todo |
| 7.6 | CPI update runbook, plus a CI check that fails when a new CSO month is published | todo |
| 7.7 | A law-change watch note. This Act will be amended, and stale legal software is worse than none | todo |
| 7.8 | Post it where tenants are: Reddit r/ireland and r/DublinCity, Threshold, college accommodation groups | todo |

---

## Deliberately not in scope

Named here so they do not creep in later.

- Any account system. The tool works with no login and that is a product decision, not a
  gap
- Storing anyone's rent, address or tenancy data on a server
- Giving legal advice, predicting a dispute outcome, or telling anyone what to do
- Northern Ireland, England, Wales or Scotland. Different law, different Act, out of scope
- Landlord-side tooling. A landlord can use the rent check, but nothing is built for them
- Filing an RTB dispute on someone's behalf

---

## Risks

| Risk | Consequence | What we do about it |
|---|---|---|
| The law changes again | The tool is confidently wrong | Dated rules engine from day one. Every result carries the rules version it used |
| The RTB calculator disagrees with us | Which one is right | Publish every disagreement and the reasoning. Do not quietly conform |
| CSO revises a CPI number | A past calculation changes | Pinned snapshots. A determination records its snapshot hash |
| Someone relies on this and loses | Real harm | Boundary in the interface. `Unknown` where inputs cannot be verified. Point to Threshold and the RTB |
| Nobody finds the site | Effort wasted | 7.8 is a task, not an afterthought |
| Scam detection has no labels | Overclaimed precision | Say there is no precision figure. Signals with reasons, not a score |
