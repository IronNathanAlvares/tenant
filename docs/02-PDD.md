# 02. Product definition

**Project:** Tenant
**Author:** Nathan Alvares
**Date:** 7 September 2026
**Status:** written in Sprint 1, carried from Sprint 0

---

## 1. The one sentence

A tenant in Ireland can find out, in under a minute and without an account, whether a rent
increase is lawful and whether the notice demanding it is valid.

## 2. Who it is for

**The person it is designed around** is someone who has just been handed a rent review
notice, does not know that the law changed on 1 March 2026, and has somewhere between a
week and three months before the new rent takes effect. They are on a phone. They are
worried. They will give the site ninety seconds before deciding it is not going to help.

Everything else follows from that. No account. No onboarding. The first screen asks a
question, not for an email address.

**Secondary, and welcome, but not designed for:** landlords checking their own compliance,
Threshold and Citizens Information advisers, and journalists. A landlord using the rent
check gets the same answer, which is fine, because the answer is the law.

## 3. What it does

Three surfaces in the first release.

**Rent check.** Given the rent, the dates and the tenancy type, produce the maximum lawful
rent, say whether the proposed figure exceeds it, and show every step of the arithmetic
with the provision it comes from.

**Notice check.** Given how the notice arrived, list the specific defects, each citing a
rule, and say which ones make the increase ineffective rather than merely irregular.

**What to do next.** A printable pack containing the inputs, the determination, the audit
trail, the citations and the deadline, plus an editable letter to the landlord and where
to go for actual advice.

## 4. What it deliberately does not do

Named here so they do not creep in.

| Not doing | Why |
|---|---|
| Legal advice, or predicting how an adjudicator will rule | We are not qualified and the line has to be visible in the interface, not the footer |
| Accounts, logins, saved cases | The whole product works without them and asking kills first-visit conversion |
| Storing anyone's rent, address or tenancy facts on a server | The calculation runs in the browser. There is nothing to store and nothing to leak |
| Filing an RTB dispute on someone's behalf | Different product, different liability, and the RTB's own process is not the bottleneck |
| Landlord compliance tooling, portfolio views, reminders | A landlord may use the rent check. Nothing is built for them |
| Northern Ireland, England, Wales, Scotland | Different Acts entirely |
| The listing scam checker | Cut from v1. [ADR-0004](adr/ADR-0004-user-initiated-fetch-not-crawl.md) explains why there is no honest way to measure it yet |
| Answering when the answer is genuinely unknown | See §6 |

## 5. Why this exists when calculators already exist

Four or five Irish rent calculators are live. The gap is not that no tool exists, it is
what they do not do, set out in [`01`](01-research-and-analysis.md) §7. In short:

1. **None are date-aware.** Section 19(6) keeps the repealed HICP regime alive for any
   notice served before 1 March 2026. A tool that only knows today's law cannot answer a
   question about a notice from January.
2. **None check the notice.** That is where a tenant's leverage actually is. A landlord who
   posted the notice to the RTB rather than uploading it the same day has handed over a
   complete answer, and no tool asks.
3. **None cite anything**, so their output is not usable in front of an adjudicator.
4. **None handle all the regimes**, so they answer confidently for cost rental tenancies
   that are outside rent control entirely.

## 6. The two rules that govern every design decision

**Be deterministic where the stakes are high.** Every number is produced by a pure function
from inputs plus a pinned CPI snapshot, and is reproducible from a hash. The model
explains the result and is structurally prevented from computing any part of it
([ADR-0002](adr/ADR-0002-model-explains-never-computes.md)).

**Say "I do not know" out loud.** The new-build carve-out at section 19(4)(aa) turns on a
building control commencement notice date a tenant cannot see. The honest answer is "the
maximum is X if the building commenced before 10 June 2025 and Y if on or after, and here
is how to find out". Picking one silently would be the single most likely way this product
hurts somebody. `Unknown` is a first-class result, not an error path.

## 7. What success looks like

| Measure | Target | When |
|---|---|---|
| Agreement with the official RTB calculator | Stated as a number over a stated N, with every disagreement explained | Sprint 2 |
| Determinations reproducible from inputs plus a snapshot hash | Asserted by a test | Sprint 1 |
| No rent or address reaches a server on the basic check | Asserted by a network test | Sprint 4 |
| Time from landing to answer | Under 60 seconds on a phone | Sprint 4 |
| Real users | Two hundred people who did not personally know me | Sprint 7 |

The first one is the headline. A tool in this domain that cannot state its agreement rate
against the official reference is asking to be trusted rather than earning it.

## 8. Known constraints

- The law changed six months ago and will change again. The rules are dated data, not code
  ([ADR-0001](adr/ADR-0001-dated-rules-engine.md)).
- The official calculator diverges from the statute in two places. We follow the calculator
  and show the statutory figure alongside it
  ([ADR-0006](adr/ADR-0006-follow-the-calculator-show-the-statute.md)).
- One live legal question, whether the 24 month review frequency still applies to
  pre-March-2026 tenancies, has no confident answer. Doc `01` §5b. The product presents
  the RTB's position and flags the argument rather than picking a side.
