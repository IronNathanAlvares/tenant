# ADR-0003. CPI is a pinned snapshot in the repository, not a live API call

**Status:** accepted
**Date:** 6 September 2026

## Context

The calculation depends on the All Items CPI. The obvious design is to fetch it from the
CSO PxStat API at request time. Three things argue against that.

**Reproducibility.** A determination might be produced today and disputed in six months.
If the CPI figure came from a live call, the calculation cannot be re-run to the same
answer. The CSO does revise index numbers.

**The wrong table is easy to reach.** During research, CSO table `CPM01` looked like the
right one. It is stale: last updated 15 January 2026 with data ending December 2025. The
live table, and the one the RTB names on its calculator page, is `CPM24`, statistic
`CPM24C01`, sub index `CP00`. A live fetch against the wrong table would have failed
silently and quietly.

**The statute points somewhere else anyway.** Section 19(4)(b) defines the current and
previous CPI numbers as the ones "published by the Board in accordance with subsection
(4C)", and subsection (4C)(b) requires the RTB to publish and maintain a table of CSO CPI
numbers. The legally operative figure is the RTB's published table, not the CSO's. Usually
identical. Not necessarily identical on a revision or a publication lag.

## Decision

CPI lives in `data/cpi/` as a dated snapshot file with a content hash and a provenance
record naming the source, table, statistic, sub index, fetch time and the dataset's own
`updated` field. The snapshot is imported into the bundle, so the site works with no
network dependency at all for the calculation.

Every `Determination` records the snapshot hash it used.

Updating CPI is a pull request with a diff, reviewed like code. A CI job checks whether
the CSO has published a month we do not have and fails if so, which turns a silent
staleness problem into a red build.

Where the RTB table and the CSO differ, the RTB value is used and the divergence is
recorded, because the statute points at the RTB's copy.

## Consequences

**Good.** Every calculation is reproducible from inputs plus a hash. The site cannot break
because an upstream API changed shape. CPI updates are visible and reviewed rather than
invisible and automatic. The client-side privacy story in ADR-0005 depends on this.

**Costs.** A monthly manual step, mitigated but not removed by the CI check. The site can
be up to a month stale if nobody merges the update, so the result view has to show the
snapshot date rather than hide it. Two sources of truth to reconcile.

**Rejected alternative.** Fetch live and cache. Simpler and always fresh, but no
reproducibility, a runtime dependency on a service that has already shown one stale
mirror, and it would have to run server side, which breaks the privacy commitment.
