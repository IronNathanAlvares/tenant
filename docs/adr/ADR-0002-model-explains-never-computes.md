# ADR-0002. The model explains, it never computes

**Status:** accepted
**Date:** 6 September 2026

## Context

The output of this tool is something a tenant may bring to an RTB adjudication. A wrong
number costs someone money or a tenancy. Language models are good at explaining a
computed result in plain English and bad at arithmetic that has to be exactly right every
time, and their failure mode is a fluent wrong answer rather than an error.

There is also a subtler risk. If the model is handed the raw inputs alongside the result,
it can quietly recompute and present its own figure. Prompt instructions telling it not
to are not an enforcement mechanism.

## Decision

The deterministic engine produces a `Determination` containing the verdict, the maximum
lawful rent, an ordered audit trail and the citations. Only that object reaches the
model. The raw form inputs do not.

Before any generated text is rendered, a guard extracts every numeric token from it and
asserts each one appears in the determination. If the assertion fails, the text is
discarded and a deterministic template is rendered instead. The same fallback runs when
the model is unavailable.

The PDF pack is generated entirely from the determination with no model involvement.

## Consequences

**Good.** The model cannot introduce a number. The failure mode is duller prose, never a
wrong figure. The site works with the model provider down. The guard is a test, so the
claim in the README is asserted rather than asserted-about.

**Costs.** The guard will produce false positives, for example a year appearing in a
citation or a rounded figure phrased differently. It needs a whitelist of numbers derived
from the determination, and tuning it is real work. Explanations are less fluent than
they would be with the model free to restate the inputs.

**Rejected alternative.** Give the model everything and instruct it to use only the
supplied figures. This is the common pattern and it is unenforceable. In a domain where
being wrong has consequences, a prompt is not a control.
