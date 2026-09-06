# ADR-0004. The listing checker fetches one page for one user, it does not crawl

**Status:** accepted
**Date:** 6 September 2026

## Context

The listing check needs the content of a rental advert. The tempting version is a crawler
building a corpus of live listings, which would give a labelled scam dataset, a rent
distribution and a way to spot a listing reposted across sites.

`daft.ie/robots.txt` disallows `/api` and a set of query patterns, and allows individual
ad detail pages. `rent.ie/robots.txt` disallows most search paths and names several bots
outright. Beyond robots there are terms of service, and a portfolio project that gets a
letter is a worse outcome than one with a smaller dataset.

## Decision

The user pastes a URL or the listing text. We fetch that one page, once, at their
request, because they are already looking at it. No crawling, no scheduled collection, no
corpus of other people's listings.

The rent plausibility check runs against **RTB published data** instead: the Rent Index by
Local Electoral Area and the Profile of the Register datasets. That is official, openly
published, meant to be used this way, and it is a better baseline than a scrape of asking
prices, because asking prices are what we are trying to assess rather than the yardstick
we assess against.

Scam signals are rule-based and stated as signals with reasons, not as a score.

## Consequences

**Good.** No robots.txt or terms problem. The comparison baseline is actual registered
rents rather than asking prices, which is the more correct measurement. Nothing is stored
about listings other people posted.

**Costs.** No cross-site duplicate detection, which is a genuinely strong scam signal and
we lose it. No labelled scam corpus, so there is no measured precision on scam
classification and the README will say so rather than inventing a number. The rent
baseline is at LEA granularity, quarterly, and lagged, so it supports "this is far below
the range" and not "this is 7 per cent below market".

**Revisit if** the RTB or a portal publishes a listings dataset, or a research data
sharing agreement becomes available.
