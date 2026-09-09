# 12. Reality check

**Written during the build, not after it.**
**Last updated:** 9 September 2026

Everywhere the design was wrong, in the order it went wrong. This is the document I would
want to read about someone else's project, so it is the one written most carefully.

Nothing here is a near miss dressed up as a save. Each entry says what was believed, what
was actually true, how the gap was found, and what changed as a result.

---

## 1. The headline number in my own README was wrong

**Believed:** the maximum lawful rent in the worked example was 2,050.08 euro. It was in the
README, in the research document and in the project pitch.

**Actually:** 2,050.00. Section 19(4)(b) pro-rates the part year but does not say how to
measure it. I measured in days, 92/365. The RTB's calculator measures in whole months. Eight
cent, on the one example the whole project was being explained through.

**Found by** reading the RTB calculator's source in Sprint 0, three sprints before I planned
to look at it.

**Changed:** the figure everywhere, plus [ADR-0006](adr/ADR-0006-follow-the-calculator-show-the-statute.md)
to decide which basis is authoritative. The lesson is narrow and worth keeping: I had
derived a number from a statute and never checked it against the reference implementation,
while writing a project whose entire premise is that other people do not check things.

## 2. The ADR I wrote to fix that was also wrong

**Believed:** ADR-0006 said the two readings of section 19(4) "differ by cents" and that the
second figure "has to be genuinely secondary in the interface".

**Actually:** measured over 2,720 cases, they differ in 54.6 per cent of them. Median gap
4.05 euro a month, p90 28.72, maximum 173.36. Only 62 of 1,484 differing cases are within
five cent.

Worse, the gap runs both ways. In **630 cases the official RTB calculator permits more than
a strict reading of the Act allows**, so a landlord using the regulator's own tool correctly
can still land above the statutory cap.

**Found by** Sprint 2's measurement, which the ADR had pre-empted.

**Changed:** ADR-0006 carries a dated correction rather than a quiet edit. The decision
stands, the presentation changed, and it became an interface requirement: the second figure
is prominent above a euro a month, and the wording differs by direction.

**The actual lesson:** I wrote an ADR asserting a quantity before measuring it, on the
strength of one example. Twice now, the same mistake in two shapes.

## 3. Sprint 2's method was built on a wrong assumption

**Believed:** the RTB Rent Calculator is a black box, so ground truth means driving the form
and harvesting a few dozen cases by hand.

**Actually:** the calculation runs entirely client side in `rent-calc.js`. The algorithm
could be read, and later executed directly under jsdom over 2,240 cases.

**Changed:** Sprint 2 went from a small hand-entered sample to a 2,720 case differential
suite plus a fidelity check against the real script. Three open questions closed early. The
plan was worse than reality in a way that cost nothing, which is the good direction, but it
was still an assumption stated as a fact in the sprint plan.

## 4. A test passed for the wrong reason, and hid a real bug

**Believed:** the rent check produced the right answer, because the test asserting
`€2,050.00` appears on the page was green.

**Actually:** the page was showing the two-branch "it depends" answer, and 2,050.00 is one of
those branches. The new-build question defaulted to `unknown` and sat behind a disclosure, so
**every first-time visitor got a question instead of an answer**, in a product whose stated
target is sixty seconds to an answer.

**Found by** writing a different test and printing the verdict label to debug it.

**Changed:** the question moved into the main form. Every result assertion now checks the
verdict, not just that a number appears somewhere. Two regression tests were added.

**The lesson worth keeping:** a test that asserts "the right string is somewhere on the page"
is not testing the thing you think. It passes when the page is showing something else that
happens to contain it.

## 5. Sprint 5's entire premise did not survive Sprint 4

**Believed, since Sprint 0:** the model would explain a finished determination in plain
English, guarded by an assertion that every number in the prose appears in the determination.

**Actually:** Sprint 4 put "nothing you typed was sent anywhere" above the fold and enforced
it with a test that traps every network primitive. A `Determination` carries someone's rent,
their dates and their tenancy type. Handing it to a model is sending their rent to a third
party.

**Changed:** the layer was dropped, not deferred. [ADR-0008](adr/ADR-0008-the-model-does-not-run-at-request-time.md)
records what was reconsidered and what it costs, which is real: no wording that adapts to
unusual cases, and no way to ask a follow-up.

Two commitments made three sprints apart turned out to be incompatible, and neither was
obviously wrong at the time. The privacy one won because it was the one already promised to
a user in a sentence on the page.

## 6. A measurement tool that measured itself wrong

**Believed:** the generated prose was somewhere around a reading grade of 10.

**Actually:** the Flesch-Kincaid function reported grade 51, which is not a value that
exists. Its number-stripping regex had a full stop inside the character class, so it removed
every sentence ending and measured one 130-word sentence.

**Changed:** fixed, and it then immediately earned its keep by catching two genuinely
overlong sentences in the landlord letter.

An implausible measurement is a bug in the measurement. Worth remembering before tuning a
threshold to make a number pass.

## 7. Three separate Vercel failures, two of them diagnosed wrongly first

Every deployment failed for several days while CI stayed green.

| Cause | How it was found | Was my first guess right |
|---|---|---|
| pnpm 11 unsupported, silently falls back to pnpm 9 | Documented issue, after a clean clone ruled out the code | No, I had blamed `vercel.json` first |
| Root Directory at the repo root, so no `next` in `package.json` | Matched a documented error exactly, reproduced locally | Partly, the fix I shipped made it worse |
| Files outside the root directory not uploaded, so `workspace:*` could not resolve | Reproduced exactly by installing `apps/web` alone | Yes |

**The honest bit:** I inferred a cause and shipped a fix three times without the build log.
Twice the inference was wrong, and one of the fixes, a `vercel.json` setting
`outputDirectory`, actively made the problem worse. Adding the placeholder page in Sprint 0
specifically to prove the deploy path was the right call and it still took days, because the
one thing that would have answered it in a minute needed account access I do not have.

**Changed:** the practice, not the code. After the second wrong inference I stopped guessing
and started reproducing failures locally before shipping a fix.

## 8. Two harnesses that failed for their own reasons

**The oracle fidelity check** reported 161 mismatches on its first run. The oracle was
correct; the case dump was using the 22-month test fixture while the script fed the RTB the
full 357-month snapshot. It was measuring a difference in inputs.

**The CPI snapshot validator** failed on its first run against a `latest_month` versus
`latestMonth` mismatch between the Python generator and the TypeScript loader.

Both are the good failure mode: a check that fails immediately, loudly, on something real,
before anything depends on it.

## 9. Accessibility was ticked "partly" and the honest version found a failure

**Believed:** the interface was accessible. Labels had been checked by hand in a real
browser, radio groups were real fieldsets, tap targets were sized.

**Actually:** input borders measured **1.62:1** in light and **1.73:1** in dark. WCAG 2.2 SC
1.4.11 requires 3:1 for UI components. The form fields were too faint to see reliably.

**Found by** refusing to close task 4.7 on a hand check, and writing a test that parses the
design tokens and computes the contrast ratio for every pair the interface uses.

**Changed:** both tokens darkened, and contrast is now a build gate rather than an opinion.

## 10. Two claims in the source material that did not survive checking

**"Nothing in the market has caught up."** False. `righttenantry.ie` handles the ordinary
case correctly. What is true is narrower: it declines every hard case explicitly, nobody is
date-aware, nobody checks the notice, nobody cites anything. The narrower claim is the one
in the README.

**The obvious CSO table is the wrong one.** `CPM01` is what you find first and it is stale,
last updated January 2026. The live series, and the one the RTB names, is `CPM24`. A live
API call would have failed silently and quietly, which is the argument in
[ADR-0003](adr/ADR-0003-pinned-cpi-snapshots.md) for pinning it.

---

## Still not right

Carried openly rather than closed off.

**The pre-2026 HICP path is not built.** Section 19(6) keeps the repealed regime alive for
notices served before 1 March 2026, so it is live law. The engine detects those, cites the
provision and refuses to answer. The structure is known and the data is located, but the
statutory definition of "HICP value" has not been read, so choosing a series would be a
guess. Doc `01` §11.

**Open question 7 needs a lawyer.** My reading of section 20(4) to (6) with the new 20B says
tenancies that began before 1 March 2026 are on a 24 month review cycle until June 2027. The
RTB says 12. The product presents the RTB's position and flags mine as an argument, and a
test asserts it never becomes a defect. That is the right behaviour for an unresolved
question, but it is not a resolution. Doc `01` §5b.

**The commencement order has not been found.** 1 March 2026 is universally reported and the
Act commences by ministerial order. Until the S.I. is read, the dated rules engine's
commencement dates are sourced from reporting rather than from law.

**Nobody has typed a case into the live RTB form by hand.** The jsdom harness runs their real
code, which is stronger for coverage, but it does not prove the page wires that code to the
form the way I assume.

**Nobody outside this project has used the site.** Every claim about it being usable in
sixty seconds is a design intention, not an observation.
