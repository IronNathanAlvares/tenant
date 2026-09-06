# 01. The RTB Rent Calculator algorithm, and where it differs from the statute

**Date:** 6 September 2026
**Sprint:** 0
**Status:** finding, verified numerically

This was scheduled as Sprint 2 work, on the assumption that the official calculator was a
black box to be probed. It is not. The calculation runs entirely in the browser and the
source is readable, so the reference implementation could be read directly instead of
inferred from samples.

**Source:** `https://rtb.ie/wp-content/themes/rtb/assets/rent-calc/Scripts/rent-calc.js`
**sha256:** `1f7a50b86efaba3197232cce6a3d8f86b3f08a651d3a8e6673b6bf83b01432d7`
**Retrieved:** 6 September 2026

The file itself is not vendored into this repository. It is the RTB's copyright, this repo
is MIT, and a hash plus a URL is enough to verify the reading below. What follows is a
description in my own words with short quoted fragments.

---

## 1. What the calculator actually does

Inputs are four: a yes/no for the post-10-June-2025 development question, the current
rent, the date rent was last set, and the date the new rent is set.

1. Look up CPI for the **month of** the last-set date. The lookup walks backwards month
   by month until it finds a published value, and flags `usedFallback` when it had to.
2. Look up CPI for the **month of** the new-set date, same walk-back.
3. `pct = ((cpiNew - cpiLast) / cpiLast) * 100`, floored at zero, so deflation never
   forces a reduction.
4. Count elapsed months:
   ```
   diff = (b.year - a.year) * 12 + (b.month - a.month)
   if (b.day < a.day) diff -= 1
   ```
5. `capPctProRata = 2 * (months / 12)`
6. If the development answer is Yes, apply the CPI percentage with no 2 per cent cap.
   Otherwise apply `min(cpiPct, capPctProRata)`.
7. `newRent = round(rent * (1 + pct/100) * 100) / 100`, so half-up to the cent.
8. Display `max(0, newRentCents - currentRentCents) / 100`.

Worth noting for the UI: **the figure the calculator displays is the maximum
increase, not the maximum new rent.** On the worked example below it shows 50.00, not
2,050.00. Anyone comparing our output to theirs has to compare the right quantity.

There is also a soft warning, not a block, when the gap is under 12 months, and a hard
validation that the new-set date is after the last-set date.

---

## 2. Divergence one: the CPI reference month

**The statute.** Section 19(4)(b) RTA 2004 as amended defines the *current CPI number* as
the number for the month **immediately preceding** the month of the new setting, falling
back one further month if that is not yet published. It defines the *previous CPI number*
asymmetrically: the month **of** the previous setting where that setting happened before
1 March 2026, and the month **immediately preceding** it where the setting happened on or
after.

**The calculator.** Uses the month **of** both dates, with a walk-back only when data is
missing.

**Does it matter in practice?** Usually not, and that is why it survives. CPI for the
current month is not published when you are setting rent today, so the walk-back lands on
the most recent published month, which is normally what the statute asks for anyway. It
diverges in two situations:

- A backdated or historical calculation, where the setting month's CPI does exist in the
  table. The calculator uses it. The statute says use the month before.
- Any previous setting on or after 1 March 2026, where the statute wants the month before
  and the calculator takes the month of. This case grows as time passes.

The calculator does not implement the asymmetry at all.

---

## 3. Divergence two: the pro-rata day count

**The statute.** Section 19(4)(b) gives 2 per cent per year elapsed, plus, for the
additional part period, "such percentage as bears to 2 per cent the same proportion that
that period bears to a year". It does not say how to measure a proportion of a year.

**The calculator.** Whole months only, with the day-of-month comparison deciding whether
the final partial month counts.

Both are defensible. Whole months is the simpler rule and it is the one the official tool
implements, so it is the one a landlord will have used and the one an adjudicator will
recognise.

---

## 4. The worked example, corrected

Rent last set 1 June 2025 at 2,000 euro, new setting 1 September 2026.

| Step | RTB calculator | Day-count reading |
|---|---|---|
| Elapsed | 15 whole months | 1 year, 92 days |
| 2% pro-rata cap | 2.5000% | 2.5041% |
| CPI last (2025-06) | 103.1 | 103.1 |
| CPI new (walk back to 2026-07) | 106.7 | 106.7 |
| CPI change | 3.4918% | 3.4918% |
| Binding constraint | percentage cap | percentage cap |
| **Maximum new rent** | **2,050.00** | 2,050.08 |

The README previously stated 2,050.08. That was my day-count reading of the statute and
it is 8 cent above what the official calculator produces. The README now states 2,050.00
and the divergence is documented here rather than quietly dropped. The engine will match
the RTB.

---

## 5. What this does to the plan

**Open question 4, rounding.** Closed. Half-up to the cent, on the new rent, before the
increase is derived by subtraction in integer cents.

**Open question 5, day count.** Closed. Whole months, with `if (b.day < a.day) diff -= 1`.

**Sprint 2 changes shape.** The original plan was to harvest ground truth by driving the
form. That is now the weaker method. The better plan is:

1. Port the RTB algorithm as a **reference oracle** in the test suite, written from this
   description, kept separate from our engine
2. Generate a large randomised case set and compare our engine against the oracle
3. Drive the real form on a small stratified sample to confirm the oracle itself is
   faithful, which is the step that keeps this honest
4. Report agreement, and report every case where our statutory reading and the RTB's
   implementation disagree

That gives a much larger N than form-driving ever would, while still grounding the oracle
in the real thing.

**A decision we now have to make deliberately.** Where the statute and the official
calculator disagree, which does the engine follow? Recorded in ADR-0006. Short version:
follow the calculator, show the statutory figure alongside it when they differ, and
explain the difference. A tenant arguing that the RTB's own calculator is wrong needs to
know that is what they are doing.
