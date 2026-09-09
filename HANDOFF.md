# Handoff

If you are picking this up cold, read in this order.

1. [`README.md`](README.md), five minutes, tells you what it is
2. [`docs/measurements/01-rtb-calculator-algorithm.md`](docs/measurements/01-rtb-calculator-algorithm.md),
   ten minutes, the most important finding in the project
3. [`SPRINTS.md`](SPRINTS.md), tells you what to do next

---

## State: Sprint 0 complete, 6 September 2026

The workspace builds, tests, typechecks, lints and deploys. There is no rules engine yet.
That is Sprint 1.

```bash
pnpm install
pnpm verify        # lint, typecheck, test
pnpm build         # next build
pnpm --filter @tenant/web dev
```

CI runs the same chain plus a CPI freshness check on every push and pull request.

| Path | What |
|---|---|
| `packages/rules/` | The engine. Currently only `money.ts`, which is deliberate |
| `apps/web/` | Next.js placeholder page. Proves the deploy path |
| `data/cpi/` | Pinned CPI snapshot, 357 months, hashed |
| `scripts/` | CPI ingest and the freshness check |
| `research/sources/` | Primary legal sources saved as text |
| `docs/` | Design docs, six ADRs, one measurement |

## Verify the data path in one command

```bash
python scripts/build_cpi_snapshot.py --from data/cpi/cso-cpm24-raw-2026-08-13.json
```

Expected `sha256 e3c47337ccbc9a8bb6cdae62c68ee246dda93f1c76b3937a9d63d78aac6c0f3c`.
If it differs, the extraction changed and every golden vector is suspect. Find out why
before doing anything else.

## Things that will bite you

**Use CSO table CPM24, never CPM01.** CPM01 is the one you find first and it is stale.

**The Irish Statute Book returns 403 without a browser user agent.** Set one.

**The 2026 Act is an amending Act.** The rules live in section 19 of the 2004 Act. Read
the consolidated version on `revisedacts.lawreform.ie`, not the 2026 Act on its own.

**Money never touches a float.** `packages/rules/src/money.ts`, integer cents. The one
exception is the reference oracle in Sprint 2, which has to reproduce the RTB's float
arithmetic to match its output. Keep that quarantined in the oracle.

**Imports inside `packages/` are extensionless.** `moduleResolution: bundler`. Adding
`.js` breaks the Next build even though tsc and Vitest accept it.

**Next rewrites `apps/web/tsconfig.json` on every build.** Biome is configured to ignore
it. Do not fight this.

**Stay on pnpm 10. Do not bump `packageManager` to 11 or 12.** Vercel does not support
pnpm 11 yet (vercel/vercel#17434). When it sees an unsupported version it silently falls
back to pnpm 9, which then fails on any pnpm 11 syntax in `pnpm-workspace.yaml`. That is
what caused the first four deployments to fail while CI stayed green, because CI honours
`packageManager` and Vercel does not. For the same reason the esbuild build allowlist
lives in `package.json` under `pnpm.onlyBuiltDependencies` rather than as `allowBuilds` in
`pnpm-workspace.yaml`: older pnpm ignores the former and chokes on the latter.

**The RTB calculator displays the maximum *increase*, not the maximum new rent.** When
comparing our output to theirs, compare the right quantity.

## Open questions that still matter

Full table in [`docs/01-research-and-analysis.md`](docs/01-research-and-analysis.md) §10.
The two live ones:

**Question 7, and it needs a solicitor.** Whether the 24 month rent review frequency still
applies to tenancies that began before 1 March 2026. Section 20(4) to (6) read with the new
section 20B(2) says it does, until 20 June 2027. The RTB's public position is 12 months
except on the section 24C path. Doc 01 §5b. The product must not pick a side silently.

**Question 8.** The commencement order for the 2026 Act. Section 1(2) commences most of it
by ministerial order. 1 March 2026 is universally reported but the S.I. itself has not been
found, and the dated rules engine should not claim sourced commencement dates until it is.

## Waiting on Nathan

- **One Vercel dashboard setting.** See below. It is the only thing blocking a live URL.
- A second opinion on open question 7, ideally from Threshold or a solicitor.

### The Vercel deployment, still failing, and I have run out of things to check from outside

The dashboard settings are now correct: Root Directory `apps/web`, "Include files outside
the root directory in the Build Step" enabled, skip-when-unchanged enabled. The last of
those is working, because a commit touching only `packages/` triggered a build rather than
being skipped, which is what "or its dependencies" is meant to do.

The build still fails, and Vercel's log needs account access.

**What has been ruled out, by reproduction rather than reasoning:**

| Cause | How it was ruled out |
|---|---|
| The code | A clean clone of `main` installs and builds a working page |
| The monorepo wiring | `cd apps/web && pnpm install --frozen-lockfile && pnpm exec next build`, which is Vercel's exact sequence with this root directory, exits 0 on both steps |
| pnpm 11 | Real problem, fixed. Vercel does not support it and falls back to pnpm 9 (vercel/vercel#17434). Pinned to 10.34.5 |
| Root Directory at the repo root | Real problem, fixed in the dashboard. Caused "No Next.js version detected" |
| Files outside the root not uploaded | Reproduced locally as `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. Fixed by the dashboard toggle |
| Builds being skipped | Was happening, no longer is |

**What is needed now is the log.** One command, and it ends the guessing:

```bash
npx vercel login
npx vercel inspect https://tenant-green.vercel.app --logs
```

Failing deployment ids are readable without auth:

```bash
gh api repos/IronNathanAlvares/tenant/deployments
gh api repos/IronNathanAlvares/tenant/deployments/<id>/statuses
```

Nothing else in the project is blocked on this. The engine, the notice check and the
measurements are all independent of whether the placeholder page is live.
