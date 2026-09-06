# ADR-0006. Where the statute and the official calculator disagree, follow the calculator and show both

**Status:** accepted
**Date:** 6 September 2026

## Context

Reading the RTB Rent Calculator's source found two places where the official
implementation does not match section 19(4) of the RTA 2004 as amended. The CPI reference
month, and the pro-rata day count. Both are documented in
[`docs/measurements/01-rtb-calculator-algorithm.md`](../measurements/01-rtb-calculator-algorithm.md).

This forces a decision that a rent calculator does not normally have to make. If we follow
our reading of the statute we produce a different number from the official tool. If we
follow the official tool we are knowingly implementing something we believe the Act does
not say.

Two things constrain the answer.

Section 22(2A)(f) requires the landlord's rent review notice to state how the rent was
calculated having regard to section 19(4). The RTB tells landlords to attach a printout
from its calculator. So the number a tenant is actually presented with is the calculator's
number, essentially always.

And a tenant who walks into an RTB adjudication arguing that the RTB's own calculator is
wrong is doing something much harder than arguing that their landlord got the arithmetic
wrong. They should be told which of those two things they are doing.

## Decision

The engine's primary output follows the RTB calculator, and the site says so.

Where our reading of the statute produces a different figure, the determination carries
both, flagged, with a plain explanation of why they differ and which one the landlord will
have used. The difference is usually cents, and the interface should not turn cents into
alarm.

The reference oracle in the test suite is a deliberate, separate port of the RTB
algorithm. Our engine is tested against it. When the RTB changes their implementation, the
oracle is updated first and the resulting test failures tell us exactly what changed.

Every determination records which basis produced the headline number.

## Consequences

**Good.** A tenant is never told their landlord is wrong when the landlord used the
official tool correctly. The disagreement becomes a documented finding rather than a
silent mismatch, which is more interesting than agreement. Tracking the RTB's
implementation becomes a test-driven process instead of a discovery.

**Costs.** We are implementing something we argue is not what the Act says, which needs
explaining carefully every time. Two calculations to maintain and two to explain. There is
a real risk of overwhelming a worried person with a distinction that moves their rent by 8
cent, so the second figure has to be genuinely secondary in the interface.

**Rejected alternative one.** Follow the statute only. Intellectually cleaner and it makes
the project look sharper, but it sets every user against the official tool over rounding
differences, which is bad advice dressed as rigour.

**Rejected alternative two.** Follow the calculator only and say nothing. Simpler and
nobody would notice. It also throws away the most interesting finding in the project and
means the docs would claim a statutory reading the code does not implement.

## Revisit when

The RTB changes `rent-calc.js`, a commencement order or statutory instrument prescribes
the calculation method under section 19(4D)(aa), or an RTB determination order addresses
either divergence. Section 19(4D)(aa) expressly lets the Minister prescribe "the means by
which the rent increase calculator shall operate", so a statutory instrument could settle
this outright.
