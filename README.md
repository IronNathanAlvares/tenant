# Tenant

Irish rental law changed on 1 March 2026. This tells you whether the rent you are being
asked to pay is lawful, and whether the notice asking for it is valid.

Standalone project. Nothing else needs to exist for it to run.

---

## Status

Research complete. No code yet. See [`SPRINTS.md`](SPRINTS.md) for what happens next.

| Sprint | What | State |
|---|---|---|
| **S0** | Foundations, remaining research, repo, CI | Not started |
| S1 | The dated rules engine | Not started |
| S2 | Ground truth against the official RTB calculator | Not started |
| S3 | Notice validity | Not started |
| S4 | Web app v1, live | Not started |
| S5 | Explanation layer and dispute pack | Not started |
| S6 | Listing check | Deferred, cut from v1 |
| S7 | Ship | Not started |

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
on 1 September 2026. The index cap allows 3.49 per cent. The percentage cap allows 2.504
per cent. The lawful maximum is **2,050.08 euro**. A tool applying a flat "2 per cent or
CPI" says 2,040.

Full derivation and every source in
[`docs/01-research-and-analysis.md`](docs/01-research-and-analysis.md).

## The architecture, in one paragraph

A dated rules engine in TypeScript with the rule history as versioned data, so any
question can be evaluated against the law as it stood on any date. The CPI table is a
pinned snapshot in the repository rather than a live API call, so a calculation re-run in
a year gives the same answer. The engine is a pure function with no I/O, which means it
runs in the browser, which means your rent and your address never reach a server. The
model is used to explain a finished determination in plain English and is never allowed
to compute anything, enforced by an assertion that every number in the generated prose
appears in the determination.

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
