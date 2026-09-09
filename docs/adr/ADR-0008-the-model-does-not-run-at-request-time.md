# ADR-0008. The model does not run at request time

**Status:** accepted
**Date:** 9 September 2026
**Supersedes the runtime half of** [ADR-0002](ADR-0002-model-explains-never-computes.md)

## Context

Sprint 5 was planned as an explanation layer: hand the finished `Determination` to a
language model, let it write the result in plainer English, and guard the output by
asserting that every number in the generated prose appears in the determination.

Sprint 4 made that impossible, and it was right to.

The page tells the visitor that everything is worked out in their browser and nothing they
typed is sent anywhere. [ADR-0007](ADR-0007-no-third-party-scripts-on-the-calculation-pages.md)
committed to that with no escape hatch, and `apps/web/tests/rent-check.test.tsx` enforces
it by trapping every network primitive.

A `Determination` is not anonymous. It contains the rent, the dates the rent was set, the
tenancy type and the proposed increase. That is the substance of someone's housing
situation. Sending it to a model API is sending their rent to a third party, and it does
not matter that their name is not attached, because the promise on the page was not "we
anonymise it", it was "it is never sent".

So the choice was: weaken the promise, or drop the layer.

## What was actually being bought

Worth asking before giving anything up. The model was going to paraphrase prose that
already exists. The engine already produces an ordered audit trail written in plain
sentences, a citation per step, and an explanation per regime. A model rewriting
"The percentage cap is lower, so it is the limit" adds very little, and it adds it at the
cost of the one architectural commitment that makes this project different from the four
calculators it is competing with.

The three things a model could genuinely add are worth naming, because two of them survive:

**Adapting the wording to an unusual case.** Real, and lost. Templates handle the common
shapes and get stiffer at the edges.

**Answering follow-up questions.** Real, and lost. "What counts as when the rent was last
set" is a question people will have, and a chat box would answer it better than a hint.
Static guidance is the substitute.

**Translation.** The most valuable of the three for this audience, and **not lost**, because
it does not need to happen at request time. Translating the interface and the templates is
build-time work, done once, reviewed by a person, and shipped as static strings. A model can
do that job in the repository, where its output is checked before anyone relies on it.

## Decision

**No model call at request time.** Not for explanation, not for summarising, not for the
letter. The pack, the summary and the letter are generated deterministically in
`packages/rules/src/pack.ts`, from the determination, in the browser.

**ADR-0002's principle stands and gets stronger.** It said the model explains and never
computes. In practice the model now does not run at all where a user's data is present, so
there is nothing for it to compute with. The rule to carry forward is the general one:
*no user's tenancy data leaves their device, for any purpose, including being explained.*

**Where a model may be used:** in the repository, at build time, on content that contains
no user data. Drafting and translating template strings is the obvious case. Its output is
reviewed and committed like any other text.

**The guard from 5.2 is not built**, because there is no generated text to guard. If runtime
generation is ever reconsidered, the guard is a precondition and not an afterthought.

## Consequences

**Good.** The promise on the homepage stays literally true and testable. No API key, no
provider dependency, no per-request cost, no latency, and the result appears as fast as the
arithmetic. The pack works with no network at all, which matters for someone assembling
evidence on a bad connection. Every sentence in the output was written by a person and can
be reviewed, which in a domain where a confident wrong sentence causes harm is worth more
than fluency.

**Costs, and they are real.** Explanations are stiffer at the edges of the rule space.
There is no way to ask a follow-up question. Adding a new phrasing means writing it rather
than prompting for it, and the templates will grow.

**Rejected alternative one.** Run the model, but only on an explicit opt-in with a clear
warning. Defensible, and it is what a larger product would do. It also turns a one-sentence
promise into a conditional one, which is exactly the thing this project is trying not to do
in a domain full of tools that overclaim.

**Rejected alternative two.** Run a small model in the browser via WebAssembly, so nothing
leaves the device. Genuinely interesting and it keeps the promise. It also means shipping
tens of megabytes to someone on a phone to paraphrase four sentences, which fails the sixty
second test in the PDD for a benefit that does not justify it.

## Revisit when

Translation is scoped, which is build-time work and unaffected by this. Or if a browser-local
model becomes small enough to be free at the point of use, at which point alternative two
stops being absurd.
