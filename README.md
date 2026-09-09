# Tenant

Irish rental law changed on 1 March 2026. This tells you whether the rent you are being
asked to pay is lawful, and whether the notice asking for it is valid.

Standalone project. Nothing else needs to exist for it to run.

---

## Status

Built, tested and documented. 246 tests. The Vercel deployment is still failing for reasons that need its build log, so it is not live yet.
See [`SPRINTS.md`](SPRINTS.md) for what happens next.

| Sprint | What | State |
|---|---|---|
| **S0** | Foundations, remaining research, repo, CI | **Complete.** CI green, deploy path proven, and it found something (below) |
| S1 | The dated rules engine | **Complete.** 90 tests. One gap left open on purpose, below |
| S2 | Ground truth against the official RTB calculator | **Complete.** 2,720 of 2,720, exact. And it disproved one of my own ADRs |
| S3 | Notice validity | **Complete.** 37 tests. One part deliberately left unbuilt, below |
| S4 | Web app v1 | **Built and tested.** Not live yet, see the deployment note |
| S5 | Dispute pack | **Complete.** The explanation layer was dropped on purpose, below |
| S6 | Listing check | Deferred, cut from v1 |
| S7 | Measure and ship | **Complete except the launch itself.** Accessibility is a CI gate now, and it found a real WCAG failure |

Hosted on Vercel, deployed from GitHub. The first release is the rent check, the notice
check and the dispute pack. The listing scam checker is designed but deliberately not in
it, because there is no honest way to measure it yet. See
[`ADR-0004`](docs/adr/ADR-0004-user-initiated-fetch-not-crawl.md).

---

## The problem

The **Residential Tenancies (Miscellaneous Provisions) Act 2026** commenced on 1 March
2026. Rent Pressure Zones were abolished and replaced with national rent control. The
inflation measure changed from HICP to CPI. New tenancies now carry a rolling six year
Tenancy of Minimum Duration. Rent review notices must reach the tenant and the RTB on the
same day or they are invalid.

Almost no tenant knows any of this. A meaningful number are paying rent that is not
lawful, and a meaningful number have received a notice that is void on its face.

## Why the existing calculators do not solve it

There are several Irish rent calculators. The one I looked at in detail still states its
formula as "min(4%, 2% + HICP)" and asks whether the property is in a Rent Pressure
Zone. Both were repealed in February 2026.

More importantly, none of them do the two things that actually decide cases:

**They are not date-aware.** Section 19(6) of the 2004 Act preserves the old HICP regime
for any rent review notice served before 1 March 2026. A tool that only knows today's law
cannot answer a question about a notice from January. Seven regimes run in parallel right
now.

**They do not check the notice.** A rent increase can be perfectly within the cap and
still void because the landlord posted the notice to the RTB instead of uploading it the
same day. That is where most tenants actually have leverage, and no tool asks the
question.

## The engineering

The formula is in section 19(4) of the Residential Tenancies Act 2004 as amended, and it
is two constraints that both have to hold, not one.

**Constraint A** caps the increase at 2 per cent of the old rent per year elapsed since
the last setting, plus a pro-rated share for the part year. Simple, not compound.

**Constraint B** caps the ratio of new rent to old rent at the ratio of the current CPI
number to the previous one.

The interesting part is which CPI numbers. The current one is the month before the new
setting, falling back a further month if that has not been published yet. The previous
one is the month *of* the previous setting if it happened before 1 March 2026, and the
month *before* it if it happened on or after. That asymmetry is in the statute, it shifts
the index by a month, and nothing I have seen implements it.

Worked example with live CSO data: rent last set at 2,000 euro on 1 June 2025, reviewed
on 1 September 2026. The index cap allows 3.49 per cent. The percentage cap allows 2.5 per
cent. The lawful maximum is **2,050.00 euro**, an increase of 50.00. A tool applying a
flat "2 per cent or CPI" says 2,040.

Full derivation and every source in
[`docs/01-research-and-analysis.md`](docs/01-research-and-analysis.md).

## The official calculator does not match the statute

The RTB Rent Calculator runs entirely in the browser, so its algorithm can be read rather
than guessed at. It diverges from section 19(4) in two places: it takes CPI from the month
*of* each date rather than the month before, and it pro-rates by whole months rather than
by any finer measure. Neither is obviously wrong, and the second is arguably the more
sensible reading of an Act that does not say how to measure part of a year.

We follow the calculator, because that is the number the landlord's notice will carry, and
we show the statutory figure alongside it when the two differ. Reasoning in
[`ADR-0006`](docs/adr/ADR-0006-follow-the-calculator-show-the-statute.md), the algorithm
itself in
[`docs/measurements/01`](docs/measurements/01-rtb-calculator-algorithm.md).

## What the engine does today

```ts
const result = evaluateRent(
  {
    tenancyKind: "private",
    previousSetting: parseDate("2025-06-01"),
    previousRent: parseEuro("2000"),
    newSetting: parseDate("2026-09-01"),
    newBuildExemption: "no",
    asOf: parseDate("2026-09-01"),
  },
  CPI_SNAPSHOT,
);
// result.headline.maxRent   -> 2050.00, the RTB basis
// result.statutory.maxRent  -> 2050.08, reading section 19(4) strictly
// result.basesAgree         -> false, and the audit trail says why
```

Ask it something it cannot honestly answer and it does not guess:

```ts
evaluateRent({ ...query, newBuildExemption: "unknown" }, CPI_SNAPSHOT);
// outcome: "unknown"
// question: "Is this dwelling in an apartment complex ... on or after 10 June 2025?"
// branches: [ 2069.84 if it qualifies, 2050.00 if it does not ]
// howToFindOut: "Ask the landlord directly. They must be able to produce the
//                commencement notice if the RTB investigates ..."
```

A rent review notice served before 1 March 2026 goes down a different path entirely, because
section 19(6) keeps the repealed regime alive for it. That regime used HICP, pivots its
asymmetry on 11 December 2021 rather than 1 March 2026, and before 20 June 2025 only applied
inside a designated Rent Pressure Zone. All three are handled. It was left refusing for three
sprints until the operative index series could be confirmed from the Act rather than guessed.

## The measurement

The engine agrees with the RTB's algorithm on **2,720 of 2,720 cases, exactly, to the
cent**, on both the maximum rent and the maximum increase.

That zero only means something if the harness could detect a difference, so the engine's
statutory basis runs through the identical comparison as a control and is flagged in 1,484
cases. A test asserts the control stays non-zero.

The transcription itself is checked against the real thing. `pnpm oracle:verify` downloads
the RTB's actual `rent-calc.js`, runs it under jsdom over 2,240 cases and compares:

```
Compared 2240 cases against the live script.
The oracle reproduces the RTB calculator exactly.
```

**And the measurement disproved one of my own decision records.** ADR-0006 claimed the two
readings of section 19(4) differ by cents. They differ in 54.6 per cent of cases, median
4.05 euro a month, maximum 173.36. Only 62 of 1,484 differing cases are within five cent.

The gap runs both ways. In **630 cases the official RTB calculator permits more than a
strict reading of the Act allows**, which means a landlord using the regulator's own tool
correctly can still end up above the statutory cap. The ADR carries a dated correction
rather than a quiet edit. Full working in
[`docs/measurements/02`](docs/measurements/02-engine-agreement.md).

## The notice check, which is the half nobody else does

A rent increase can sit perfectly inside the cap and still be worth nothing. Section 22(1)
says a rent set on review "shall not have effect unless and until" the section 22(2)
condition is met, and since 1 March 2026 that condition includes serving a copy on the RTB
**the same day** it is served on the tenant. The RTB itself warns that posting it can miss
that.

```ts
assessNotice({
  servedOnTenant: parseDate("2026-06-01"),
  servedOnBoard:  parseDate("2026-06-04"),   // posted, arrived three days later
  newRentEffectiveFrom: parseDate("2026-09-01"),
  ...
});
// rentTakesEffect: false
// defect: board-same-day, severity "rent-has-no-effect", citing s. 22(2)
// disputeDeadline: 2026-09-01, basis "effective-date"
```

Three things it is careful about:

**An unanswered question is never a passed check.** Every requirement takes yes, no or
unknown, and unknown produces an entry saying what it would have covered.

**Not every breach voids the increase.** An unsigned notice comes back as `unclear` rather
than voiding, because section 22(2B) sits outside the section 22(2) condition and it is
genuinely arguable. Telling someone their notice is void when it is merely irregular sends
them into a dispute they lose.

**The deadline is computed and returned even when the notice is defective.** Section 22(3)
gives the later of the effective date or 28 days from receipt, which in practice means the
day the rent changes. Miss it and the amount cannot be disputed at all.

## The site

Two pages, both static, both doing all their work in the browser.

The privacy line on the homepage says your rent and address are never sent anywhere. That
is not a promise, it is a test: `fetch`, `XMLHttpRequest`, `WebSocket` and
`navigator.sendBeacon` are all replaced with traps that fail the build if anything calls
them during a calculation. It is also why there is no Sentry and no analytics on those
pages, which is a real cost and is written down in
[`ADR-0007`](docs/adr/ADR-0007-no-third-party-scripts-on-the-calculation-pages.md).

Sprint 2's measurement turned into an interface rule here. Where the RTB's figure and a
strict reading of the Act disagree, the second figure appears prominently above a euro a
month and quietly below it, and the wording changes with the direction: a statutory figure
that is *lower* than the RTB's means the increase may exceed the statutory cap even though
the landlord used the official tool, which is a different and more delicate thing to tell
someone.

## The architecture, in one paragraph

A dated rules engine in TypeScript with the rule history as versioned data, so any
question can be evaluated against the law as it stood on any date. The CPI table is a
pinned snapshot in the repository rather than a live API call, so a calculation re-run in
a year gives the same answer. The engine is a pure function with no I/O, which means it
runs in the browser, which means your rent and your address never reach a server. The
model is used to explain a finished determination in plain English and is never allowed
to compute anything, enforced by an assertion that every number in the generated prose
appears in the determination.

## What is wrong with it

[`docs/12-reality-check.md`](docs/12-reality-check.md) is the document worth reading. Ten
entries, written during the build. The short version: I got my own headline figure wrong and
shipped it in this README, I wrote a decision record asserting a quantity before measuring it
and the measurement contradicted it, a test passed for the wrong reason and hid a real bug in
the form, and I inferred a deployment failure three times without the log and was wrong twice.

Still open and named rather than buried: one legal question needs a solicitor, the
commencement order has not been found, and nobody outside this project has used the site.

## What it is not

It tells you what the rules say. It is not legal advice, it does not predict what an
adjudicator will decide, and it says "I do not know" when the answer turns on something
it cannot verify. It points to Threshold and the RTB for the next step.

## Layout

```
docs/          design documents and decision records
research/      primary sources, saved locally
data/cpi/      pinned CPI snapshots with provenance
data/vectors/  golden test vectors from the official RTB calculator
packages/      the rules engine and the CPI package
apps/web       the Next.js site
```
