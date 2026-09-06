# ADR-0005. TypeScript, and the engine is a pure function

**Status:** accepted
**Date:** 6 September 2026

## Context

My previous three portfolio projects are Python: uv, ruff, mypy, pytest, hypothesis,
import-linter. Continuing in Python would be the path of least resistance and would reuse
a toolchain I already trust.

The thing that decides against it is a product requirement rather than a language
preference. This tool should give a stranger an answer on first visit with no account, no
network round trip carrying their rent and address, and no server that can be down when
they need it. That means the calculation runs in the browser. Running it in the browser in
Python means Pyodide, which is a several megabyte download for a page whose whole promise
is a fast answer on a phone.

The alternative, two implementations, is worse. Two implementations of a legal calculation
drift, and the drift is silent.

## Decision

TypeScript throughout, in a pnpm workspace.

- `packages/rules` is a **pure function**. No I/O, no clock, no network, no environment
  access. Time enters as an explicit `asOf` parameter and CPI enters as an injected
  snapshot. Enforced by a dependency rule in CI, the equivalent of import-linter.
- `packages/cpi` handles ingest and snapshot generation. It is a build-time tool and the
  engine never imports it.
- `apps/web` is Next.js on Vercel and imports the engine directly for client-side
  evaluation.

Testing follows the same discipline as the Python projects: Vitest for unit and golden
vector tests, fast-check for property tests, and the dependency rule asserted in CI.

## Consequences

**Good.** One implementation, used identically in the browser, on the server for the PDF,
and in the test harness. Purity makes the engine trivially testable and makes the privacy
claim structural rather than a promise. A pinned CPI snapshot plus a pure function means
determinations are byte-reproducible.

**Costs.** A different toolchain from the rest of the portfolio, so the repos are not
uniform. TypeScript's type system is weaker than mypy in strict mode at the things that
matter here, particularly around exhaustive matching on regimes, so the regime resolver
needs discriminated unions and explicit never-checks rather than relying on the compiler.
Decimal arithmetic needs care: money calculations must not run through IEEE floats, so a
minor-units integer representation is required from the start rather than retrofitted.

**Rejected alternative.** Python engine behind an API, thin JavaScript front end. Reuses
the existing toolchain and gives better numeric types, but every calculation becomes a
request carrying someone's rent and address to a server, which is the one thing the
product promises not to do.
