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
| 0.12 | Minimal `apps/web` that actually deploys, so the Vercel path is proven now rather than in Sprint 4 | **blocked on one dashboard setting.** The app builds from a clean clone with Vercel's own commands. Vercel's Root Directory needs to be `apps/web`. See HANDOFF |
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

Adding 0.12 was worth it precisely because it failed. Every Vercel deployment has been
failing while CI stayed green, and finding that out now cost an hour. Finding it out in
Sprint 4, with a real app to debug at the same time, would have cost a lot more. Two
separate causes so far: pnpm 11 is unsupported by Vercel, and the project's Root Directory
points at the repo root. The first is fixed in the repo, the second needs the dashboard.

---

## Sprint 1. The rules engine

**Goal:** a pure TypeScript function that takes a rent question and an as-of date and
returns a determination with a full audit trail.
**Ends with:** the worked example in doc 01 §2 computed correctly by code, plus the
regime matrix covered by tests.

| # | Task | Status |
|---|---|---|
| 1.0 | Carried from Sprint 0: write `docs/02-PDD.md` and `docs/03-requirements.md` | **done.** Requirements carry IDs the tests reference |
| 1.1 | `packages/rules`: types for `RentQuery`, `Determination`, `AuditStep`, `Citation` | **done** |
| 1.2 | CPI ingest, plus `packages/cpi` which validates the snapshot at load | **done.** The validator caught a real field-name mismatch on its first run |
| 1.3 | CPI lookup with the publication-lag fallback, both the current and previous variants | **done** |
| 1.4 | Regime resolver: given tenancy facts and a date, return which of the seven regimes applies | **done.** Exhaustive at compile time via `assertNever` |
| 1.5 | Constraint A, relevant percentage. Simple not compound, whole years plus pro-rated remainder | **done.** Both the whole-month and day-count readings |
| 1.6 | Constraint B, index ratio, with the pre/post 1 March 2026 reference month asymmetry | **done.** The asymmetry has its own tests |
| 1.7 | Section 19(5) market rent paths, returning "no cap applies" with the reason | **done** |
| 1.8 | Section 19(6) in-flight notice path | **partly.** Detected, cited and routed to `not-answerable` pointing at Threshold. The HICP arithmetic itself is not built. See below |
| 1.9 | Every branch returns a `Citation` with Act, section, subsection and a URL | **done.** Asserted for every outcome |
| 1.10 | Audit trail: an ordered list of steps a human can check by hand | **done** |
| 1.11 | `Unknown` as a first-class result when an input the tool cannot verify decides the answer | **done.** Carries both branches, each fully computed |

**The hard part was 1.11, and it worked.** Asking with `newBuildExemption: "unknown"`
returns an `unknown` outcome carrying two fully computed branches, EUR 2,069.84 and
EUR 2,050.00 on the worked example, plus the question that separates them and how to put it
to a landlord.

### What Sprint 1 did not finish

**1.8 is partly done and the gap is deliberate.** A notice served before 1 March 2026 is
correctly detected, cited to section 19(6) and routed to a `not-answerable` result that
sends the person to Threshold. The pre-2026 HICP arithmetic behind it is not implemented.
Building it properly needs the HICP series, which is a different CSO table with a different
base, and the RPZ geography rules for settings before 20 June 2025. Answering that badly is
worse than saying plainly that we do not cover it, so the engine says so. It is now a
Sprint 3 task.

**Purity is asserted, not claimed.** `packages/rules/tests/purity.test.ts` strips comments
from every source file and fails the build on `new Date`, `Math.random`, `fetch`,
`process`, `node:`, browser globals or `console`. The privacy and reproducibility claims in
the README rest on that, so it is a test rather than a convention.

90 tests. Requirements in `docs/03-requirements.md` have IDs and the tests name them, so
`grep -r R-CPI-05 packages/` finds what defends the asymmetry.

---

## Sprint 2. Ground truth and the headline number

**Goal:** the metric the project is judged on.
**Ends with:** a published match rate against the official RTB calculator, and the
rounding and day-count conventions settled by evidence rather than guess.

| # | Task | Status |
|---|---|---|
| 2.1 | ~~Work out whether the RTB calculator is drivable~~ **Done in Sprint 0.** It is client-side JS and was read directly | done |
| 2.2 | Port the RTB algorithm as a **reference oracle**, kept separate from our engine | **done.** `packages/rules/tests/rtb-oracle.ts` |
| 2.3 | Differential testing of our engine against the oracle | **done.** 2,720 cases, 100% agreement to the cent |
| 2.4 | Prove the oracle is faithful | **done, and better than planned.** `scripts/verify_oracle.mjs` runs the RTB's actual `rent-calc.js` under jsdom over 2,240 cases. Zero mismatches |
| 2.5 | Golden vectors in `data/vectors` with provenance, and the published match rate | **done.** `oracle-cases.json`, `agreement-summary.json`, `oracle-fidelity.json` |
| 2.6 | Carried from Sprint 0: review righttenantry.ie, propdesk.ie, tenantsync.ie properly | **not done.** Carried again to Sprint 3 |
| 2.7 | Property tests with fast-check | **done in Sprint 1.** Monotonicity, never exceeding either cap, never throwing |
| 2.8 | Write `docs/measurements/02-engine-agreement.md` | **done** |

### What Sprint 2 found

**The headline: 2,720 of 2,720, exact to the cent.** That number is only worth something
because the harness demonstrably detects differences, which is why the statutory basis runs
through the same comparison as a control and is flagged in 1,484 cases. A test asserts the
control stays non-zero.

**The measurement contradicted ADR-0006.** The ADR asserted the two readings of section
19(4) differ by cents. They differ in 54.6 per cent of cases, with a median gap of 4.05
euro a month and a maximum of 173.36, and the gap runs both ways: in 630 cases the official
calculator permits **more** than a strict reading of the Act allows. ADR-0006 now carries a
dated correction. The decision stands, the presentation changes, and that becomes a Sprint 4
interface requirement.

**Task 2.4 came out better than planned.** Instead of typing a handful of cases into the
form, `scripts/verify_oracle.mjs` downloads the RTB's actual `rent-calc.js`, runs it under
jsdom, and compares 2,240 cases against the transcription. Zero mismatches, against a file
whose hash matches the one transcribed from.

Its first run reported 161 mismatches, and the cause was my harness rather than the oracle:
the two sides were using different CPI data. Recorded in `measurements/02` §7, because that
is the failure mode this kind of comparison is most prone to.

**Report the failures.** A match rate of 100 per cent on 12 easy cases is worth less than
97 per cent on 400 with the three failures explained. If we disagree with the RTB
calculator and we are right, that is a finding and it goes in the README.

---

## Sprint 3. Notice validity

**Goal:** Surface 2.
**Ends with:** a defect list for a set of hand-built notice scenarios.

| # | Task | Status |
|---|---|---|
| 3.0 | Carried from Sprint 1: the pre-2026 HICP regime behind section 19(6) | **investigated, deliberately not built.** Structure confirmed identical to the current one, data located (CSO CPM23). Blocked on confirming which HICP series was operative. Doc 01 §11 |
| 3.0b | Carried from Sprint 0 and 2: review righttenantry.ie, propdesk.ie, tenantsync.ie properly | **done.** Doc 01 §7a. One of them is now actively wrong |
| 3.1 | `packages/rules/notice`: `NoticeQuery` and `Defect` types, each defect citing a rule | **done** |
| 3.2 | 90 day rule, counted from service to the date the new rent takes effect | **done** |
| 3.3 | Same-day RTB filing rule, only for notices served on or after 1 March 2026 | **done.** Not applied retrospectively, which is tested |
| 3.4 | Frequency rule, section 20 with the new section 20B | **done.** Under 12 months is a defect. The contested 12-to-24 month case is an open argument, not a defect |
| 3.5 | Required contents, all of section 22(2A) | **done.** Eleven checks including RT numbers on the comparables |
| 3.6 | Prescribed form | **done.** The one month registration update is a separate obligation and is not modelled |
| 3.7 | Severity model | **done.** Four levels. An unsigned notice is `unclear`, not voiding, because s. 22(2B) sits outside the s. 22(2) condition |
| 3.8 | Scenario tests | **done.** 37 tests |

**3.7 needed care and got it.** Not every breach voids a notice. The severity model has
four levels, and two decisions in it are worth defending:

An **unsigned notice** is `unclear`, not voiding. Section 22(2B) sits outside the section
22(2) condition that section 22(1) hangs the rent's effect on, so on the face of the Act it
is arguable either way. Claiming it voids the increase would send someone into a dispute on
a weaker footing than they think they have.

A **missing BER** is not asserted as a defect at all. It is only required where the Energy
Performance of Buildings Regulations apply to the building, which a tenant cannot reliably
determine, so it is raised as a question rather than a finding.

### What Sprint 3 delivered

The notice engine, 37 tests, passing first run. The scenario the product exists for is a
test: a rent increase perfectly inside the cap, void because the landlord posted the RTB
copy three days late.

**The section 22(3) deadline is computed.** The later of the date the rent takes effect or
28 days from receipt, which in practice means the effective date, with a countdown and a
`passed` flag. It is returned even when the notice is defective, because someone whose
notice is void still needs to know the date.

**An unanswered question is never a passed check.** Every requirement takes yes, no or
unknown, and unknown produces an entry in `notAssessed` explaining what it would have
covered. A tenant who answered three questions is told what the other ten were.

**The contested frequency point is presented as an argument, not a defect.** My reading of
section 20(4) to (6) with the new 20B says a pre-March-2026 tenancy is on a 24 month cycle
until June 2027. The RTB says 12. The engine reports the RTB's position, raises mine as
something to ask Threshold about, and a test asserts it never becomes a defect.

---

## Sprint 4. The web app, v1

**Goal:** a live URL a stranger can use with no account.
**Ends with:** deployed, on the real domain, with Surfaces 1 and 2 working.

| # | Task | Status |
|---|---|---|
| 4.1 | Next.js app, App Router | **done.** Two static pages, both prerendered |
| 4.2 | The engine runs client side. Nothing is sent to a server | **done, and asserted.** A test traps `fetch`, `XMLHttpRequest`, `WebSocket` and `sendBeacon` and fails if any fires during a calculation |
| 4.3 | Rent check form, progressive | **done, after a correction.** See below |
| 4.4 | Result view: verdict, maximum, step by step calculation, citations | **done.** Nine audit steps, five citations, all linking to the provision |
| 4.5 | Notice check flow | **done.** Service dates first, nine content questions behind a disclosure |
| 4.6 | Boundary statement above the fold | **done.** On both pages |
| 4.7 | Accessibility | **partly.** Labels, hints and errors verified wired in a real browser. Radio groups are real fieldsets with legends. Contrast and a full keyboard pass are not yet measured, so this carries to Sprint 7 |
| 4.8 | Mobile first | **done.** One column, 16px minimum inputs so iOS does not zoom, native date pickers, tap targets at 2.9rem |
| 4.9 | Sentry and analytics | **deliberately not done.** Writing the privacy test turned this into a decision. See ADR-0007 |
| 4.10 | Static CPI snapshot shipped with the bundle, version and date shown | **done.** Every result names the CPI month, the rules version and the snapshot hash |

**4.2 is the design commitment**, and it held. The engine being pure meant the page needed
no server at all, and the claim is now enforced by a test rather than promised.

### The form had a real bug, and a test was passing for the wrong reason

The new-build question started life behind the "add more detail" disclosure with a default
of `unknown`. That meant **every first-time visitor got the two-branch "it depends" answer
rather than a figure**, which is the opposite of a sixty second product.

Worse, the worked-example test passed anyway, because 2,050.00 is one of the two branches.
It was asserting that a number appeared somewhere on the page, not that the page had reached
a conclusion. That is the sort of test that makes things look fine while they are not.

Fixed by moving the question into the main form and defaulting it to the common case.
Defaulting it to `no` while leaving it hidden would have been worse than the bug: it would
quietly assume people out of a regime they might be in. Every result assertion now checks
the verdict label, and there are two regression tests, one that the default gives a direct
answer and one that the question is not inside a `<details>`.

### 4.9 changed rather than slipped

Task 4.9 said to add Sentry and analytics. The R-PRIV-03 trap test would fail if either
were added, because both work by instrumenting exactly the network primitives the test
traps, and that is the test doing its job. A page that says "nothing you typed was sent
anywhere" cannot also ship a script whose purpose is to send things. ADR-0007 records the
decision and, honestly, what it costs: no error telemetry and no funnel data.

### What Sprint 4 delivered

Two pages, both static, 166 tests overall. The rent check gives the worked example's answer
in a real browser, with the audit trail, the citations and the statutory divergence at
2,050.08 shown alongside. Sprint 2's measurement became the interface rule it should have
been: the second figure appears prominently above a euro a month, quietly below it, and the
wording changes depending on which direction the gap runs, because a statutory figure that
is *lower* than the RTB's means something quite different to the reader.

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

**5.2 was the whole safety argument, and it is now moot in a better way.** The guard existed
to stop a model inventing a number. There is no model at request time, so there is no number
to invent.

### The sprint's premise did not survive Sprint 4

Sprint 5 was specified in Sprint 0 as a model explanation layer. Sprint 4 then put
"nothing you typed was sent anywhere" above the fold and enforced it with a test that traps
every network primitive. A `Determination` carries someone's rent, their dates and their
tenancy type. Sending it to a model is sending their rent to a third party, and the promise
was not "we anonymise it".

So the layer went, and what it was buying got looked at honestly. Two of the three things a
model would have added are genuinely lost: wording that adapts to unusual cases, and the
ability to ask a follow-up. The third and most valuable for this audience, translation, is
not lost at all, because it is build-time work a model can do in the repository where a
person reviews the output. ADR-0008.

**No PDF library either.** The browser's own print-to-PDF works offline, adds nothing to the
bundle, exists on every device, and keeps the document on the device. A JavaScript PDF
generator would add hundreds of kilobytes to a page whose promise is a fast answer.

### Two things the tests caught

**The readability check found its own bug first.** It scored the prose at grade 51, which is
not a real Flesch-Kincaid value. The number-stripping regex had a full stop inside its
character class, so it ate every sentence ending and read the whole summary as one 130 word
sentence. Fixed, and it then caught two genuinely overlong sentences in the letter, which
were split.

**The notice page produced no letter.** `buildPack` required a rent determination before it
would write one, so someone who only checked their notice got nothing. That is backwards: a
defective notice is often the stronger of the two grounds. Fixed, with a test that the
notice-only letter does not invent a rent figure it was never given.

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
