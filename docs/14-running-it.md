# 14. Running it, and keeping it correct

Every command, and the two maintenance jobs that stop a legal tool going quietly wrong.

---

## 1. From a clean clone

```bash
pnpm install
pnpm verify        # lint, typecheck, 246 tests
pnpm build         # both pages, static
```

Prerequisites: Node 20+, pnpm 10 (pinned in `packageManager`), Python 3.11+ for the CPI
scripts, standard library only.

**Stay on pnpm 10.** Vercel does not support pnpm 11 and silently falls back to pnpm 9,
which then fails on pnpm 11 syntax. See `HANDOFF.md`.

To run it:

```bash
pnpm --filter @tenant/web dev     # http://localhost:3000
```

## 2. What each command is for

| Command | What it proves |
|---|---|
| `pnpm test` | The engine, the pages, accessibility, contrast, and that no network call happens during a calculation |
| `pnpm typecheck` | Strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| `pnpm lint` | Biome, formatting and rules |
| `pnpm build` | Both pages compile and prerender |
| `pnpm oracle:verify` | Downloads the RTB's live `rent-calc.js`, runs it under jsdom over 2,240 cases and compares it to our transcription. Needs the network, so it is not in CI |
| `python scripts/check_cpi_freshness.py` | Fails if the CSO has published a CPI month the pinned snapshot does not have, or revised one it does |
| `python scripts/build_cpi_snapshot.py` | Rebuilds the snapshot from CSO PxStat CPM24 |

---

## 3. The monthly job: updating CPI

The CSO publishes CPI monthly, usually around the middle of the following month. The CI job
`cpi-freshness` fails the build when the snapshot falls behind, so this surfaces itself
rather than needing a reminder.

```bash
python scripts/build_cpi_snapshot.py     # fetches CPM24, writes the raw response and the snapshot
python scripts/check_cpi_freshness.py    # should now print "CPI snapshot is current"
pnpm verify
```

Then open a pull request. **Review the diff.** It should be one new month appended and
nothing else. Two things to look for:

**A changed value in an existing month.** The CSO revises. A revision changes answers already
given, which is exactly why the snapshot is pinned and hashed
([ADR-0003](adr/ADR-0003-pinned-cpi-snapshots.md)). Note it in the pull request rather than
merging it silently.

**A changed hash with no changed months.** That means the extraction changed, not the data.
Stop and find out why before merging, because every golden vector is then suspect.

**Retention.** Keep the raw CSO response for the snapshot in use and for any snapshot a
published determination still references. Older ones can go. Do not accumulate one per month
forever.

---

## 4. The job nobody schedules: watching the law

This is the one that decides whether the project is still worth anything in a year. A rent
calculator that is quietly six months out of date is worse than no calculator, because it
is confidently wrong and it looks maintained.

Irish residential tenancies legislation changed materially in 2021, 2022, 2024, 2025 and
2026. Assume it will change again.

### What to watch, and how often

| Source | Watch for | How often |
|---|---|---|
| [Irish Statute Book, 2004 Act](https://www.irishstatutebook.ie/eli/2004/act/27/) "Commencement, Amendments, SIs" tab | Any new amending Act or commencement order | Quarterly |
| [Revised Acts, section 19](https://revisedacts.lawreform.ie/eli/2004/act/27/section/19/revised/en/html) | New F-notes on 19(4), 19(5) or 19(6) | Quarterly |
| [Revised Acts, section 22](https://revisedacts.lawreform.ie/eli/2004/act/27/section/22/revised/en/html) | Changes to the notice requirements | Quarterly |
| `rtb.ie/rtb-rent-calculator` | A changed `rent-calc.js` hash | Run `pnpm oracle:verify`, which reports it |
| RTB guidance pages | A changed published position, especially on review frequency | Quarterly |

### Two dates already in the diary

**20 June 2027.** The extended review period in section 20(6) ends. After that the 24 month
argument in doc `01` §5b falls away on any reading, and
`EXTENDED_REVIEW_PERIOD_ENDS` in `packages/rules/src/notice.ts` stops mattering. There is a
test that the argument disappears after that date.

**1 March 2029.** Student specific accommodation market rent resets begin, on a three year
cycle. Section 19(5)(ac). Not currently modelled, because nothing turns on it yet.

### When something does change

1. Read the amending provision itself, not the reporting. The 2026 Act is an amending Act
   and the operative rules live in the 2004 Act, which is the mistake to avoid.
2. Add a rule version with its commencement date. Do not edit the existing one. Old
   determinations must stay reproducible ([ADR-0001](adr/ADR-0001-dated-rules-engine.md)).
3. Bump `RULES_VERSION`.
4. Run `pnpm oracle:verify`. If the RTB changed their implementation too, update the oracle
   **first**, then let the test failures tell you exactly what moved.
5. Update `docs/01-research-and-analysis.md` with the new provision and its source.

### If it cannot be maintained

Say so on the site rather than leaving it running. A stale legal tool with no visible date
is the failure mode this project exists to argue against. Every result already carries the
rules version and the CPI month it used, which makes staleness visible to the reader as well
as to the maintainer.

---

## 5. Deployment

Vercel, from GitHub. Project settings that matter, all of them learned the hard way:

- **Root Directory:** `apps/web`
- **Include files outside the root directory in the Build Step:** enabled, because
  `apps/web` depends on `@tenant/rules` and `@tenant/cpi` by `workspace:*`
- **Framework Preset:** Next.js, which auto-detects once the root directory is right

Security headers are set in `apps/web/next.config.ts` and verified served. The CSP includes
`connect-src 'none'`, which tells the browser this page never makes a network request. That
is the same promise the homepage makes in words and the test suite enforces in code, and it
is the layer an attacker cannot talk their way past.

To check them on a deployment:

```bash
curl -sI https://<the-url>/ | grep -i "content-security-policy"
```
