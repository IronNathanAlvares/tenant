# 03. Requirements

**Date:** 7 September 2026
**Status:** written in Sprint 1

Every requirement has an ID. Tests reference the ID in their description, so
`grep -r "R-CAP-03" packages/` finds the test that defends it. A requirement with no test
is not done, whatever the code says.

**Status key:** `S1` built in Sprint 1 · `S3` notice engine · `S4` web · `planned` later

---

## R-DATE, dates and arithmetic

| ID | Requirement | Status |
|---|---|---|
| R-DATE-01 | Dates are plain calendar dates. No `Date` object, no timezone, no clock. A determination computed in Dublin and in Los Angeles is identical | S1 |
| R-DATE-02 | The current date enters only as an explicit `asOf` parameter. The engine never reads the system clock | S1 |
| R-DATE-03 | Elapsed whole months are counted as `(y2-y1)*12 + (m2-m1)`, less one if the day of month of the later date is lower. This is the RTB's rule and it is reproduced deliberately | S1 |
| R-DATE-04 | Invalid dates are rejected at parse, not coerced. `2026-02-30` is an error | S1 |

## R-MONEY, money

| ID | Requirement | Status |
|---|---|---|
| R-MONEY-01 | Money is held as integer minor units. No amount of money is ever stored in a float | S1 |
| R-MONEY-02 | Amounts with more than two decimal places are rejected, not rounded | S1 |
| R-MONEY-03 | Parsing then formatting an amount returns the original amount, for every amount up to one million euro | S1 |
| R-MONEY-04 | The final rent is rounded half up to the nearest cent, matching the RTB calculator | S1 |

## R-CPI, the index

| ID | Requirement | Status |
|---|---|---|
| R-CPI-01 | CPI is injected into the engine as a snapshot. The engine performs no I/O to obtain it | S1 |
| R-CPI-02 | A CPI lookup for a month with no published value walks back one month at a time until it finds one, and reports that it did so | S1 |
| R-CPI-03 | **RTB basis:** the CPI numbers are those for the month *of* the previous setting and the month *of* the new setting | S1 |
| R-CPI-04 | **Statutory basis:** the current CPI number is the month immediately preceding the new setting, falling back a further month if unpublished | S1 |
| R-CPI-05 | **Statutory basis:** the previous CPI number is the month *of* the previous setting where that setting was before 1 March 2026, and the month *immediately preceding* it where the setting was on or after | S1 |
| R-CPI-06 | Every determination records the snapshot hash and latest month it used | S1 |
| R-CPI-07 | A CPI change below zero is treated as zero. Deflation does not force a rent reduction | S1 |

R-CPI-05 is the asymmetry in section 19(4)(b) that no other tool implements. R-CPI-03 and
R-CPI-04 differ deliberately: see [ADR-0006](adr/ADR-0006-follow-the-calculator-show-the-statute.md).

## R-REG, regime resolution

| ID | Requirement | Status |
|---|---|---|
| R-REG-01 | Cost rental tenancies return "outside rent control", citing Affordable Housing Act 2021 s. 33(1) | S1 |
| R-REG-02 | Approved Housing Body tenancies return "outside rent control" | S1 |
| R-REG-03 | Where a section 22(2) notice was served before 1 March 2026, the pre-2026 HICP regime applies, citing section 19(6) | S1 |
| R-REG-04 | Where the dwelling qualifies under section 19(4)(aa), the 2 per cent cap does not apply and only the CPI constraint binds | S1 |
| R-REG-05 | Where the section 19(4)(aa) qualification is not known, the engine returns `Unknown` carrying both branches, not a guess | S1 |
| R-REG-06 | Where section 19(5) disapplies the cap, the engine returns "no cap", the reason, and the citation, and does not produce a maximum | S1 |
| R-REG-07 | The regime is selected by date, so the same query with a different `asOf` or notice date can resolve differently | S1 |
| R-REG-08 | Every regime branch is exhaustively checked at compile time. Adding a regime without handling it is a type error | S1 |

## R-CAP, the calculation

| ID | Requirement | Status |
|---|---|---|
| R-CAP-01 | Both constraints are evaluated and the binding one is the lower. Neither alone is the answer | S1 |
| R-CAP-02 | Constraint A is 2 per cent **of the old rent** per year elapsed. Simple, not compound. Three years is 6 per cent, not 6.12 | S1 |
| R-CAP-03 | Constraint A pro-rates the part period. On the RTB basis that is by whole months. On the statutory basis it is by days | S1 |
| R-CAP-04 | Constraint B caps the ratio of new rent to old rent at the ratio of the current CPI number to the previous | S1 |
| R-CAP-05 | The maximum lawful rent never exceeds either constraint, for any input | S1 |
| R-CAP-06 | The maximum is monotonic in the old rent. A higher starting rent never yields a lower maximum | S1 |
| R-CAP-07 | Where the new setting date is not after the previous setting date, the engine returns an error rather than a number | S1 |
| R-CAP-08 | The determination reports the maximum new rent **and** the maximum increase, because the RTB calculator displays the increase and users will compare | S1 |
| R-CAP-09 | Where the RTB basis and the statutory basis differ, both figures appear in the determination, with the RTB one as the headline | S1 |

## R-OUT, output and auditability

| ID | Requirement | Status |
|---|---|---|
| R-OUT-01 | Every determination carries an ordered audit trail a person can check by hand with a calculator | S1 |
| R-OUT-02 | Every branch that decides an outcome attaches a citation naming the Act, the provision and a URL | S1 |
| R-OUT-03 | The determination records the rules version that produced it | S1 |
| R-OUT-04 | The same inputs and the same snapshot always produce the same determination, byte for byte | S1 |
| R-OUT-05 | The engine is a pure function. No I/O, no clock, no environment, no randomness | S1 |
| R-OUT-06 | No branch throws for a well-formed query. Failures are values, not exceptions | S1 |

## R-NOT, notice validity

Specification in [`01`](01-research-and-analysis.md) §5a. Built in Sprint 3.

| ID | Requirement | Status |
|---|---|---|
| R-NOT-01 | Notice served at least 90 days before the new rent takes effect, s. 22(2) | S3 |
| R-NOT-02 | Copy served on the RTB the same day as on the tenant, s. 22(2), for notices served on or after 1 March 2026 | S3 |
| R-NOT-03 | Not more frequent than the applicable review interval, s. 20. Where the interval is contested, present the RTB position and flag the argument | S3 |
| R-NOT-04 | Required contents present: three register comparables with RT numbers, floor area, BER, calculation basis, signature, date, dispute deadline statement | S3 |
| R-NOT-05 | Each defect states whether it renders the increase ineffective under s. 22(1) or is a breach without that effect | S3 |
| R-NOT-06 | Where the law is unclear whether a defect voids the notice, say it is unclear | S3 |

## R-SAFE, the boundary

| ID | Requirement | Status |
|---|---|---|
| R-SAFE-01 | The scope statement appears in the interface above the fold, not in a footer | S4 |
| R-SAFE-02 | The dispute deadline is the most prominent element whenever an increase appears unlawful | S4 |
| R-SAFE-03 | Threshold and the RTB are named with contact details on every result | S4 |
| R-SAFE-04 | No output states or implies what an adjudicator will decide | S4 |
| R-SAFE-05 | Generated prose containing a number not present in the determination is discarded, and a deterministic template rendered instead | S5 |

## R-PRIV, privacy

| ID | Requirement | Status |
|---|---|---|
| R-PRIV-01 | The rent check completes entirely in the browser. No rent, address or tenancy fact is sent to a server | S4 |
| R-PRIV-02 | Analytics events carry no rent amounts, addresses or dates | S4 |
| R-PRIV-03 | The claim in R-PRIV-01 is asserted by a test that fails if any network request occurs during a calculation | S4 |

---

## Out of scope, restated

Nothing in this document requires an account, a database of users, a server-side
calculation, or a stored case. If a future requirement seems to need one, it is probably
the wrong requirement.
