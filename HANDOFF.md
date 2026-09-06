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

- **The Vercel deployment still returns 404.** See below.
- A second opinion on open question 7, ideally from Threshold or a solicitor.

### The Vercel 404

`https://tenant-green.vercel.app/` returns `X-Vercel-Error: NOT_FOUND` as of the last
push. GitHub has the code, CI is green, and `pnpm build` produces a working static page
locally, so this is a Vercel project configuration problem rather than a code one. The CLI
here is not authenticated and it is your account, so it needs you.

There is a `vercel.json` at the repo root that should make this zero-config:

```json
{
  "buildCommand": "pnpm --filter @tenant/web build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs"
}
```

In the Vercel dashboard, check in this order:

1. **Deployments tab.** Is there a deployment for commit `515daa4`? If it failed, the build
   log says why and that is the actual answer.
2. **Settings, General, Framework Preset.** If it was saved as "Other" when the repo had no
   app, that overrides `vercel.json`. Set it to **Next.js**.
3. **Settings, General, Root Directory.** Should be the repo root, blank or `./`.
4. Redeploy.

If that does not take, the alternative is Root Directory `apps/web` with "Include files
outside of the Root Directory in the Build Step" enabled, in which case delete the root
`vercel.json` so the two do not fight.
