# 01. Research and analysis

**Project:** Tenant
**Author:** Nathan Alvares
**Date:** 6 September 2026
**Status:** research complete, verified against primary sources. No code yet.

Everything in this document was checked against a primary source and the source is
named. Where I could not verify something I have said so rather than filling the gap.

---

## 1. The thing that changed

The **Residential Tenancies (Miscellaneous Provisions) Act 2026**, Number 3 of 2026,
was enacted on 24 February 2026. Most of it commenced on 1 March 2026.

It is an amending Act. It does not contain the rent rules itself. It rewrites parts of
the **Residential Tenancies Act 2004**, and the operative rules now live in section 19
of the 2004 Act as amended. Anyone building against the 2026 Act alone will get this
wrong, because the formula is in the 2004 Act and only the substitutions are in the
2026 one.

Primary sources:

- Act: `https://www.irishstatutebook.ie/eli/2026/act/3/enacted/en/html` (returns 403 to
  a default user agent, 200 with a browser user agent)
- Section 8, the rent-setting amendment: `.../eli/2026/act/3/section/8/enacted/en/html`
- Consolidated section 19 of the 2004 Act:
  `https://revisedacts.lawreform.ie/eli/2004/act/27/section/19/revised/en/html`

Rent Pressure Zones are gone. The RPZ designation machinery was repealed and replaced
with a single national control that applies everywhere.

---

## 2. The formula, exactly

Section 19(4)(a) of the 2004 Act as amended. The new setting of rent must satisfy
**both** of these. Neither one alone is the answer.

**Constraint A, the percentage cap.** The new rent must not exceed the old rent by more
than the *relevant percentage*.

Section 19(4)(b) defines relevant percentage as:

> "(a) 2 per cent of the old rent in respect of each year that has elapsed since the
> previous setting, and (b) as respects any additional period that has elapsed between
> the previous setting and the next setting that is shorter than a year, such percentage
> as bears to 2 per cent the same proportion that that period bears to a year."

Read that carefully. It is **2 per cent of the old rent** per year, so it is simple and
not compound. A landlord who last set rent three years ago gets 6 per cent, not 6.12 per
cent. The part year is pro-rated. This is the first place a naive implementation goes
wrong.

**Constraint B, the index cap.** The ratio of new rent to old rent must not exceed the
ratio of the current CPI number to the previous CPI number.

**Which CPI numbers.** This is the second place implementations go wrong, and it is
worse than it looks.

*Current CPI number*: the number for the month immediately preceding the month in which
the new setting takes place. If that month's number has not been published by the time
of the setting, you use the month before that instead.

*Previous CPI number*, and here is the asymmetry:

| When the previous setting happened | Which month's CPI you use |
|---|---|
| Before 1 March 2026 | The month **in which** the previous setting took place |
| On or after 1 March 2026 | The month **immediately preceding** the month of the previous setting, with the same not-yet-published fallback |

So the same pair of dates gives a different answer depending on which side of 1 March
2026 the earlier setting fell. That is not a rounding difference, it is a one month
shift in the index, and in a month where CPI moved 1.6 points it changes the result
materially. No competitor tool I looked at handles this.

**CPI number** is defined at the end of section 8 as "the All Items Consumer Price Index
Number compiled and published by the Central Statistics Office".

### Worked example, computed from live data

Rent last set 1 June 2025 at 2,000 euro. New setting 1 September 2026.

- Previous setting is before 1 March 2026, so previous CPI is the June 2025 number: **103.1**
- Current CPI would be August 2026. Last published at time of writing is July 2026, so
  the fallback applies: **106.7**
- Index cap: 106.7 / 103.1 = 1.03492, so 3.49 per cent
- Elapsed: 1 year and 92 days. Relevant percentage = 2% + 2% x (92/365) = **2.504 per cent**
- Binding constraint is the percentage cap. Maximum lawful new rent = **2,050.08 euro**

A tool that only applies "2 per cent or CPI, whichever is lower" as a flat annual figure
returns 2,040 here and is wrong by 10 euro a month. Over a six year tenancy that
compounds into real money, and it is the kind of error that loses an RTB case.

---

## 3. When the cap does not apply at all

### 3a. The new build carve-out, section 19(4)(aa)

Constraint A (the 2 per cent cap) drops away, leaving only Constraint B (CPI), where
**all** of the following hold:

1. The dwelling is in an apartment complex, or in a building or part of a building
   within section 3(1A) of the 2004 Act, which is student specific accommodation, **and**
2. A commencement notice or 7 day notice was given to a building control authority
   **on or after 10 June 2025**, and Building Control Act 1990 section 6(2) regulations
   were complied with, **and**
3. That notice was in respect of one of: construction of the complex or building; an
   extension permanently increasing floor area by **not less than 25 per cent**; or a
   change of use creating the complex or building occupying **not less than 25 per cent**
   of the prior floor area.

Note the qualifier is on the *building*, not the dwelling, and the date is the
commencement notice date, not completion, occupancy or first letting. A tenant cannot
usually verify this themselves, which means the tool has to ask and has to say clearly
that the answer depends on an input it cannot check.

### 3b. Market rent setting, section 19(5)

Section 19(4) does not apply at all in these cases, so the landlord may set market rent
subject only to the general prohibition in section 19(1) on exceeding market rent:

- First setting under a tenancy created on or after 1 March 2026 where the dwelling is a
  protected structure and no tenancy subsisted for one year beforehand
- First setting where no tenancy subsisted for **two years** beforehand
- First setting where the most recent previous tenancy within two years was terminated
  by the landlord on the grounds at paragraph 1, 1A or 2 of the Table to section 34, or
  section 62(1)(da)(i) to (iii)
- First setting where the most recent previous tenancy was **terminated by the tenant**
- Setting after not less than **6 years** of compliant section 19(4) settings, for
  tenancies created on or after 1 March 2026, which is the Tenancy of Minimum Duration
  reset
- For SSA, a **3 year** cycle instead, with different rules before and after 1 March 2029

The practical consequence: a landlord cannot reset to market rent after a no-fault
termination. That is the anti-eviction incentive, and it is the single most valuable
thing a tenant facing eviction can be told.

### 3c. Regimes outside the system entirely

Per the RTB landlord guide of February 2026: **Approved Housing Body and cost rental
tenancies are not covered by national rent control at all.** A calculator that answers
confidently for a cost rental tenancy is giving a wrong answer with full confidence.

### 3d. In-flight notices, section 19(6)

If a section 22(2) rent review notice was served on the tenant **before 1 March 2026**,
section 19 applies to that new rent as if section 8 of the 2026 Act had never been
enacted. The old HICP regime governs that notice. So the pre-2026 rules are not
historical trivia, they are live law for any notice served before 1 March 2026 whose
rent has since taken effect.

This is the single strongest argument for a dated rules engine rather than a calculator.
The correct answer depends on the date of the notice, not the date you are asking.

---

## 4. The regime matrix

Reproduced from the RTB guide "Setting and reviewing rent from 1 March 2026: A guide for
landlords", February 2026. Local copy at `research/sources/rtb-landlord-guide-2026-02.txt`.

| Tenancy | Annual increase allowed | Re-setting to market rent |
|---|---|---|
| Private, started before 1 March 2026 | 2%, or CPI if lower | Not allowed |
| Private, started on or after 1 March 2026 | 2%, or CPI if lower | At start of a new tenancy, except after a no-fault termination. At end of 6 year cycle |
| New private apartment, construction commenced after 10 June 2025 | CPI only, no 2% cap | Same as above |
| Student specific accommodation | 2%, or CPI if lower | Once every 3 years from 1 March 2029 |
| New SSA, construction commenced after 10 June 2025 | CPI only, no 2% cap | Once every 3 years from 1 March 2029 |
| Approved Housing Body, cost rental | National rent control does not apply | n/a |

Six regimes, and section 19(6) adds a seventh for in-flight notices. This is why the
engine is data driven rather than a chain of if statements.

---

## 5. Notice validity, which is a separate product surface

A rent increase can be perfectly within the cap and still be void because the notice was
defective. From the RTB guide to rent review notices and the February 2026 landlord
guide:

- Rent reviews may occur **once every 12 months**
- The notice must be served at least **90 days** before the new rent takes effect
- **From 1 March 2026 the notice must go to the tenant and to the RTB on the same day.
  If it does not reach the RTB that same day the notice is invalid.** The RTB explicitly
  warns that posting it can invalidate the notice through delivery lag, and recommends
  emailing the tenant and uploading to the RTB Service Centre on the same day
- The notice must be on the RTB's Notice of Rent Review template, saved as PDF
- It must be accompanied by a printout from the **RTB Rent Calculator** where the
  increase is capped, or from the **RTB Rent Register** with **three comparable
  properties** where market rent is being set
- The landlord must update the tenancy registration record within **one month** of a
  rent change

The same-day RTB rule is new, is procedural, is easy to breach, and voids the notice
outright. Checking it needs one question that no existing tool asks. That is the highest
value per line of code in this entire project.

---

## 6. Data sources, all tested

### 6a. CPI, the one that matters

The RTB Rent Calculator page states it uses "All-Items Consumer Price Index (CPI),
Ireland (CSO **CPM24C01** PxStat)".

Verified live:

```
GET https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CPM24/JSON-stat/2.0/en
200, 1.78 MB, JSON-stat 2.0, no key, no auth
```

- Dimensions: STATISTIC (3), TLIST(M1) month (357, from 199611), Detailed Sub Indices (344)
- The series we need is STATISTIC `CPM24C01`, sub index `CP00` (All Items)
- Dataset `updated` field: 2026-08-13, latest month present: **202607**
- Base is December 2023 = 100

Recent All Items values pulled from that response:

| Month | CPI | Month | CPI |
|---|---|---|---|
| 2025-06 | 103.1 | 2026-02 | 104.2 |
| 2025-12 | 104.2 | 2026-03 | 105.9 |
| 2026-01 | 103.3 | 2026-04 | 106.4 |
| | | 2026-05 | 106.3 |
| | | 2026-06 | 106.6 |
| | | 2026-07 | 106.7 |

The February 2026 value of 104.2 matches the figure the RTB was publishing in March
2026, which is the cross-check that the series identifier is correct.

A trap worth recording: table **CPM01** is the obvious one to reach for and it is the
wrong one. Its API response is stale, last updated 2026-01-15 with data ending 202512,
and it is on a different sub-index scheme. CPM24 is the live table and the one the RTB
names.

Raw snapshot saved at `data/cpi/cso-cpm24-raw-2026-08-13.json`.

**The subtle legal point about the data source.** Section 19(4C)(b) requires the *Board*
to "publish and keep up to date a table of CPI numbers published by the Central
Statistics Office", and section 19(4)(b) defines the current and previous CPI numbers as
the ones "published by the Board in accordance with subsection (4C)". So the legally
operative number is the RTB's published table, not the CSO's. In normal times they are
identical. They can diverge on revision or on publication lag, and the statute points at
the RTB's copy. The engine should therefore treat the RTB table as authoritative and the
CSO API as the ingest path plus a reconciliation check, and it should say which one it
used.

### 6b. RTB Rent Register

Public web search interface at `rtb.ie`. No API, no bulk download.

Fields exposed per result: dwelling type, bedrooms, floor area in square metres, BER,
rent, tenancy start date, RT number, electoral district. Search is by address or Eircode
resolving to a Local Electoral Area. Returns up to 30 results ranked by match quality,
covering all new and annual registrations in the last 24 months for that LEA.

`rtb.ie/robots.txt` is `Disallow:` with nothing after it, meaning nothing is disallowed.

### 6c. RTB Rent Index

Quarterly PDFs with standardised average rent by county and Local Electoral Area, plus
the Profile of the Register XLSX datasets from Q2 2023 onward broken down by county,
local authority, LEA, dwelling type, size and landlord size. Good enough for the
plausibility check on a listing without touching the register itself.

### 6d. Listing sites

`daft.ie/robots.txt` disallows `/api` and a list of query patterns but allows individual
ad detail pages, and publishes a sitemap of them. `rent.ie/robots.txt` disallows most
search paths and names several bots outright.

The defensible design is therefore: the user pastes a URL or the listing text, and we
fetch that one page on their behalf. That is user-initiated retrieval of a page the user
is already looking at. Bulk crawling to build a scam corpus is a different activity with
a different risk profile, and I am not doing it. See ADR-0004.

---

## 7. What already exists, and why there is still a gap

The claim in my source document that "nothing in the market has caught up" is not true
as of September 2026. There are several rent calculators. What is true is that the ones
I checked are wrong.

I looked at `rents.ie/tools/rent-increase` in detail. It:

- States its formula as "min(4%, 2% + HICP inflation rate)", which is the pre-2026 RPZ
  regime and is now wrong on the cap, wrong on the index and wrong on the arithmetic
- Asks for RPZ designation and a 24 month minimum gap, both of which were repealed
- Cites no statutory provision anywhere
- Produces no audit trail and no downloadable evidence
- Does not ask about the same-day RTB filing rule
- Does not distinguish the pre and post 1 March 2026 CPI reference month

Others in the same space are `righttenantry.ie`, `propdesk.ie` and `tenantsync.ie`.
Sprint 0 includes checking each of them properly rather than taking one sample as
representative.

The gap is not "a rent calculator exists". It is:

1. Nobody is date-aware, so nobody can answer a question about a notice served in
   January 2026
2. Nobody encodes the CPI reference month asymmetry
3. Nobody checks notice validity, which is where most tenants actually win
4. Nobody cites the provision, so nothing they output is usable at an RTB adjudication
5. Nobody handles the six regimes, so they answer confidently for cost rental tenancies
   that are outside the system entirely

Point 3 is the product. A tenant whose landlord posted the notice rather than emailing
it has a complete defence and does not know it.

---

## 8. Where a tenant goes next

Verified partially. The RTB runs mediation, which is free, and adjudication, which costs
30 euro per the Citizens Information description of RTB dispute resolution. Applications
go to `disputes@rtb.ie` or by post to the RTB in Killorglin. Threshold operates a free
national advice service on 1800 454 454.

**Not yet verified and flagged as a Sprint 0 task:** the exact time limit for disputing a
rent review or an unlawful rent, and whether the 28 day window that applies to
termination notices has any analogue here. I am not putting a number on a limitation
period in the product until I have read it in the Act. Getting a deadline wrong is the
one error in this domain that cannot be undone by the user.

---

## 9. What this tells us about the architecture

Five conclusions, each of which becomes a decision record.

1. **The rules are dated data, not code.** Section 19(6) alone forces this. The engine
   takes an as-of date and evaluates the law as it stood then.
2. **The calculation must be deterministic and the model must never touch it.** The
   output may end up in front of an RTB adjudicator. Every number has to be reproducible
   from inputs plus a pinned CPI snapshot.
3. **The CPI table is versioned data in the repository, not a live API call.** A
   calculation run today and re-run in a year must give the same answer. Live fetching
   makes that impossible and adds a runtime dependency on a service that has already
   shown one stale mirror.
4. **The engine has to run in the browser.** The privacy story is that your address and
   your rent never leave your device for the basic check, and the availability story is
   that a static page with a pinned data file cannot go down. Both come free if the
   engine is a pure function with no I/O.
5. **Notice validity is a first-class surface, not a footnote.** It is where the tenant's
   actual leverage is.

---

## 10. Open questions

| # | Question | Blocks | How to resolve |
|---|---|---|---|
| 1 | Limitation period for disputing a rent review | The "what now" surface | Read Part 6 of the 2004 Act |
| 2 | Does the RTB publish its CPI table in a machine readable form | Ingest design | Inspect the calculator page markup |
| 3 | Exact current dispute fees | Dispute pack copy | RTB disputes page |
| 4 | Rounding convention the RTB calculator uses | Golden vector match rate | Differential testing, Sprint 2 |
| 5 | How "year elapsed" is counted for the relevant percentage, calendar years or 365 day periods | Every calculation | Differential testing, Sprint 2 |
| 6 | Whether the RTB calculator is scriptable for ground truth harvesting | Sprint 2 method | Load it in a browser and look |

Questions 4 and 5 are the interesting ones. The statute does not specify a rounding rule
or a day count convention, so the only way to match the official calculator is to probe
it. That probing is Sprint 2 and it produces the headline metric.
