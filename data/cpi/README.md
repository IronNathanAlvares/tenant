# CPI data

`cpi-all-items.json` is the pinned snapshot the engine reads. It carries a sha256 over
its own canonical form plus a provenance block naming the source table, statistic, sub
index and the CSO dataset's own `updated` timestamp.

`cso-cpm24-raw-*.json` is the untouched API response the snapshot was derived from. It is
kept because the CSO revises index numbers, so re-fetching in six months does not prove
what the series said on the day a determination was produced. That reproducibility is the
whole point of ADR-0003.

**Retention.** Keep the raw response for the snapshot currently in use and for any
snapshot a published determination still references. Older ones can be dropped. Do not
accumulate one per month indefinitely.

Rebuild and verify:

```bash
python scripts/build_cpi_snapshot.py --from data/cpi/cso-cpm24-raw-2026-08-13.json
```
