# ADR-0007. No third-party scripts on the pages that do the calculation

**Status:** accepted
**Date:** 9 September 2026

## Context

Sprint 4 task 4.9 was "Sentry, and privacy-respecting analytics with no rent values in any
event". Writing the test for R-PRIV-03 turned that into a decision rather than an install.

The page tells the visitor, in the boundary statement above the fold, that everything is
worked out in their browser and their rent and address are never sent anywhere. The test at
`apps/web/tests/rent-check.test.tsx` enforces that literally: `fetch`, `XMLHttpRequest`,
`WebSocket` and `navigator.sendBeacon` are all replaced with traps that fail the test if
anything calls them during a calculation.

Adding Sentry would break that test, and correctly so. Sentry works by instrumenting
exactly those primitives. Its default breadcrumbs capture DOM interactions and, depending on
configuration, input values. An error thrown while someone is mid-calculation could carry
their rent, their dates and their tenancy type to a third party. Analytics is milder but the
same shape: a script whose job is to send something, on a page that promises to send
nothing.

There is a version of this that is technically defensible. Disable breadcrumbs, scrub
inputs, sample nothing but exceptions. But then the promise on the page becomes "nothing is
sent, except when something goes wrong, and then only some things", which is not a sentence
worth putting in front of a worried person, and it is not a sentence a test can enforce.

## Decision

**No third-party scripts on `/` or `/notice`.** No error reporting, no analytics, no tag
manager, no fonts loaded from another origin. Both pages are static, and the only JavaScript
they run is this repository's own.

The R-PRIV-03 trap test stays as the enforcement. If someone later adds a dependency that
phones home, the test fails and the conversation happens before the deploy rather than
after.

**What replaces the two things 4.9 was for:**

*Knowing the site is not broken* is handled by the build and the test suite, plus an uptime
check that requests the page from outside rather than instrumenting it from within. A tool
this small does not need session-level error telemetry to know it works.

*Knowing anyone is using it* can be answered by server-side request counts from the hosting
platform, which need no script on the page and see no form values. If that turns out not to
be enough, the next option is a self-hosted, cookieless counter on a separate origin, and it
still does not go on the calculation pages.

## Consequences

**Good.** The promise on the page is literally true and is asserted by a test. There is
nothing to configure, no DSN to leak, no consent banner to write, and no cookie policy,
because there are no cookies. The pages stay fast, which matters for someone on a phone.

**Costs.** Real ones. A JavaScript exception on someone's device is invisible to us, so a
browser-specific bug could sit there unnoticed. There is no funnel data, so questions like
"how many people fill in two fields and give up" cannot be answered. Both of those are
things I would normally want, and giving them up is the price of the sentence at the top of
the page.

**Rejected alternative.** Sentry with breadcrumbs off and input scrubbing on. Common,
defensible, and it would probably never leak anything. It also makes the privacy claim
conditional, unenforceable by test, and dependent on a third party's default configuration
not changing under us.

## Revisit when

There is evidence of a real bug that only reproduces on someone else's device and cannot be
reproduced locally. At that point the honest move is a temporary, clearly disclosed
diagnostic, not permanent instrumentation.
