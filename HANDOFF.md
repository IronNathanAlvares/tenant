# Handoff

If you are picking this up cold, read in this order.

1. [`README.md`](README.md), five minutes, tells you what it is
2. [`docs/01-research-and-analysis.md`](docs/01-research-and-analysis.md) §2 and §3, ten
   minutes, tells you the formula and why it is not the obvious one
3. [`SPRINTS.md`](SPRINTS.md), tells you what to do next

---

## State as of 6 September 2026

Research is done and verified against primary sources. There is no application code yet.
What exists:

| Path | What |
|---|---|
| `docs/01-research-and-analysis.md` | The law, the data sources, the competitors, the open questions |
| `docs/adr/` | Five decision records, all accepted |
| `SPRINTS.md` | Eight sprints, tasks broken out |
| `research/sources/` | Primary sources saved as text, so the build does not depend on the sites staying up |
| `data/cpi/cpi-all-items.json` | Working CPI snapshot, 357 months, hashed |
| `scripts/build_cpi_snapshot.py` | The ingest, working |

## Verify the setup in one command

```bash
python scripts/build_cpi_snapshot.py --from data/cpi/cso-cpm24-raw-2026-08-13.json
```

Expected output:

```
months   357  (1996-11 to 2026-07)
updated  2026-08-13T11:00:00.000Z
sha256   e3c47337ccbc9a8bb6cdae62c68ee246dda93f1c76b3937a9d63d78aac6c0f3c
```

If the hash differs, the extraction changed and every golden vector is suspect. Find out
why before doing anything else.

To fetch fresh CSO data instead, drop the `--from` argument. That writes a new raw
snapshot alongside the existing one and will produce a different hash, which is expected
when a new month is published.

## Prerequisites

Python 3.11+ for the ingest script, standard library only. Node 20+ and pnpm for
everything from Sprint 0 onward, none of which exists yet.

## Things that will bite you

**Use CSO table CPM24, never CPM01.** CPM01 is the one you find first and it is stale,
last updated 15 January 2026. CPM24 is what the RTB names.

**The Irish Statute Book returns 403 without a browser user agent.** Set one.

**The percentage cap is simple, not compound.** 2 per cent of the *old* rent per year
elapsed. Three years is 6 per cent, not 6.12.

**The previous CPI reference month is asymmetric.** Month *of* the previous setting if it
was before 1 March 2026, month *before* it if on or after. This is the detail that
distinguishes the project. Do not simplify it away.

**Money never touches a float.** Integer minor units from the first line of the engine.

## Open questions that block work

Listed with owners in `docs/01-research-and-analysis.md` §10 and as tasks 0.4 to 0.9 in
`SPRINTS.md`. Tasks 0.4, 0.8 and 0.9 block Sprint 1. Do not start the engine before
reading section 22 of the 2004 Act and the pre-2026 HICP regime.

## Decisions taken, 6 September 2026

- Repo is `github.com/IronNathanAlvares/tenant`, matching the convention set by
  `mcp-sentinel`, `wayfinder` and `leafline`
- Hosting is Vercel, deployed from GitHub. The free `*.vercel.app` URL is the public
  address for v1. A custom domain is optional and nothing depends on it
- Sprint 6, the listing check, is cut from the first release
- One sprint per session, reviewed before the next starts

## Waiting on Nathan

- The GitHub repo URL, so the remote can be added and the first commit pushed
