# 11. Interview pitch

How to explain this, demo it, and defend it.

---

## 1. In thirty seconds

Irish rental law changed on 1 March 2026. Rent Pressure Zones were abolished, the inflation
measure changed, and a rent review notice now has to reach the RTB the same day it reaches
the tenant or the increase does not take effect.

This works out whether a rent increase is lawful and whether the notice demanding it is
valid. It runs entirely in the browser, cites the provision behind every figure, and says
"I do not know" when the answer turns on something it cannot check.

**The line worth landing:** the interesting part is not the calculator. It is that the
official calculator and the Act itself disagree, by a median of four euro a month and up to
a hundred and seventy three, and I can prove it.

## 2. If they only remember one thing

I built a reference oracle from the regulator's own code and ran 2,720 cases through both.
The engine matches the RTB exactly, every case, to the cent.

Then I ran the same comparison against a strict reading of the statute as a control, and
found the two disagree in **54.6 per cent** of cases. In **630** of them the official
calculator permits **more** than the Act allows.

That number is only worth something because the harness can demonstrably detect a difference,
which is what the control is for, and there is a test asserting the control stays non-zero so
it cannot rot into a comparison that always agrees.

## 3. The three decisions to talk about

**The rules are dated data, not code.** Section 19(6) keeps the repealed HICP regime alive
for any notice served before 1 March 2026, so seven regimes run in parallel right now. The
engine takes an `asOf` date. Without that it simply cannot answer a question about a notice
from January, which is the thing every competing calculator gets wrong.

**"I do not know" is a first-class result.** The exemption at section 19(4)(aa) turns on a
building control commencement notice date a tenant cannot see. Ask with that unknown and you
get both branches fully computed, the question that separates them, and how to put it to a
landlord. Guessing would be the single most likely way this product hurts someone.

**Two commitments made three sprints apart turned out to be incompatible.** The plan had a
model explaining results in plain English. Then the site promised nothing leaves the browser
and enforced it with a test. A determination carries someone's rent, so explaining it to a
model means sending it. The privacy commitment won because it was the one already promised to
a user in a sentence on the page. ADR-0008 says what that cost.

## 4. The demo, in three minutes

1. **Type the worked example.** €2,000, last set 1 June 2025, new rent 1 September 2026.
   The answer appears as you type: **€2,050.00**, with the full audit trail and a citation
   on every step.
2. **Point at the second figure.** Reading the Act strictly gives €2,050.08. Explain that
   this is where the RTB's own tool and the statute part company, and that across a few
   thousand cases the gap reaches €173 a month and sometimes runs in the tenant's favour.
3. **Set the new-build question to "I don't know".** Watch it refuse to guess and produce
   both branches instead.
4. **Go to the notice check.** Enter a notice served 1 June, filed with the RTB on 4 June.
   The increase did not take effect, citing section 22(2), with the dispute deadline and a
   letter you could send.
5. **Open the network tab and show it is empty.** Then show the test that enforces that.

## 5. Questions to expect, and honest answers

**"Why not just call the RTB's calculator?"**
It has no API, it is client-side JavaScript on their page, and depending on it would mean
sending the user's rent to rtb.ie. It also cannot answer anything about the notice, which is
where the actual leverage is.

**"How do you know your legal reading is right?"**
For the arithmetic, I do not rely on my reading. I match the official implementation and show
my statutory reading beside it when they differ. For the parts where the law is genuinely
contested, section 20's review frequency, the product presents the RTB's position and flags
mine as an argument, with a test asserting it never becomes a stated defect.

**"What happens when the law changes again?"**
Rules are versioned data with commencement dates, and every determination records the rules
version that produced it. Adding an amendment is a row, not a rewrite. That is the whole
reason for ADR-0001.

**"Isn't a 100 per cent match rate suspicious?"**
It would be, on its own. That is why the control exists. Ask me about the 1,484 flagged
cases.

**"What is wrong with it?"**
Read `12-reality-check.md`. Short version: I got my own headline figure wrong and shipped it
in the README, I wrote an ADR asserting a quantity before measuring it and the measurement
contradicted it, a test passed for the wrong reason and hid a real UX bug, and I inferred a
deployment failure three times without the log and was wrong twice.

**"What is not built?"**
The pre-2026 HICP path. The structure is known and the data located, but the statutory
definition of "HICP value" has not been read, so picking a series would be a guess. The
engine refuses those cases and points at Threshold. Refusing is the correct behaviour where
being wrong is unrecoverable.

## 6. What not to claim

- Not that it is legal advice. It says so above the fold, not in a footer.
- Not that it predicts an outcome. There is a test forbidding that language in the letter.
- Not that anyone has used it. Nobody outside the project has.
- Not that accessibility is finished. Contrast, keyboard path and axe are gated in CI;
  nobody has tested it with a screen reader on a real device.

## 7. The numbers, if asked

| | |
|---|---|
| Agreement with the RTB algorithm | 2,720 of 2,720, exact |
| Control disagreements, proving the harness works | 1,484 |
| Oracle checked against the RTB's real script | 2,240 cases, zero mismatches |
| Tests | 246 |
| CPI months pinned, with a content hash | 357 |
| Regimes encoded | 7 |
| Network requests during a calculation | 0, asserted by a test and by CSP |
