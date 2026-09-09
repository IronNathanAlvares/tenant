"""Build a pinned index snapshot from CSO PxStat.

Two series, because two regimes are live at once.

**CPI**, table CPM24, statistic CPM24C01, sub index CP00. The RTB Rent Calculator page names
"CSO CPM24C01 PxStat" as its source, and section 8 of the 2026 Act defines the CPI number as
"the All Items Consumer Price Index Number compiled and published by the Central Statistics
Office".

**HICP**, table CPM23, statistic CPM23C01, sub index CP00. Section 6 of the Residential
Tenancies (No. 2) Act 2021 defines HICP values as "the values contained in the most recent
data available monthly in the All-Items Harmonised Index of Consumer Prices in relation to
Ireland and published monthly by the Central Statistics Office in accordance with Regulation
(EU) 2016/792". That is CPM23C01/CP00. This one still matters because section 19(6) keeps the
pre-2026 regime alive for any notice served before 1 March 2026.

The RTB Rent Calculator page names its source as "All-Items Consumer Price Index (CPI),
Ireland (CSO CPM24C01 PxStat)", so that is the series we take: statistic CPM24C01,
sub index CP00 (All Items).

Do not switch CPI to CPM01. CPM01 looks right, is stale, and uses a different sub index
scheme. See docs/adr/ADR-0003-pinned-cpi-snapshots.md.

Usage:
    python scripts/build_cpi_snapshot.py                    # both series, live
    python scripts/build_cpi_snapshot.py --series hicp      # one of them
    python scripts/build_cpi_snapshot.py --from FILE        # rebuild CPI from a saved response
"""

import argparse
import hashlib
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

API = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/{table}/JSON-stat/2.0/en"

SERIES = {
    "cpi": {
        "table": "CPM24",
        "statistic": "CPM24C01",
        "statistic_label": "Consumer Price Index",
        "sub_index": "CP00",
        "sub_index_label": "All Items",
        "out": "cpi-all-items.json",
        "why": (
            "The RTB Rent Calculator page names CSO CPM24C01 PxStat as its source. "
            "Section 19(4)(b) RTA 2004 as amended defines the CPI number by "
            "reference to the table the RTB publishes under section 19(4C)(b)."
        ),
    },
    "hicp": {
        "table": "CPM23",
        "statistic": "CPM23C01",
        "statistic_label": "EU HICP",
        "sub_index": "CP00",
        "sub_index_label": "All Items",
        "out": "hicp-all-items.json",
        "why": (
            "Section 6 of the Residential Tenancies (No. 2) Act 2021 defines HICP values as "
            "the All-Items Harmonised Index of Consumer Prices in relation to Ireland, "
            "published monthly by the CSO under Regulation (EU) 2016/792. That is "
            "CPM23C01/CP00. Still operative for notices served before 1 March 2026, via "
            "section 19(6)."
        ),
    },
}

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "cpi"


def index_map(dimension: dict) -> dict[str, int]:
    idx = dimension["category"]["index"]
    return idx if isinstance(idx, dict) else {k: i for i, k in enumerate(idx)}


def extract(raw: dict, statistic: str, subindex: str) -> tuple[list[dict], str]:
    dims = raw["dimension"]
    dim_ids = raw["id"]
    size = raw["size"]
    values = raw["value"]

    maps = [index_map(dims[d]) for d in dim_ids]
    stat_dim, time_dim, sub_dim = 0, 1, 2

    if statistic not in maps[stat_dim]:
        sys.exit(f"statistic {statistic} not present, table layout changed")
    if subindex not in maps[sub_dim]:
        sys.exit(f"sub index {subindex} not present, table layout changed")

    s = maps[stat_dim][statistic]
    c = maps[sub_dim][subindex]

    series = []
    for month, t in sorted(maps[time_dim].items()):
        flat = (s * size[time_dim] + t) * size[sub_dim] + c
        v = values[flat] if isinstance(values, list) else values.get(str(flat))
        if v is None:
            continue
        series.append({"month": f"{month[:4]}-{month[4:]}", "value": v})

    return series, raw.get("updated", "")


def build(name: str, src: str | None) -> None:
    spec = SERIES[name]
    url = API.format(table=spec["table"])

    if src:
        raw = json.loads(pathlib.Path(src).read_text(encoding="utf-8"))
        fetched_at = None
    else:
        with urllib.request.urlopen(url, timeout=60) as r:
            body = r.read()
        raw = json.loads(body)
        fetched_at = datetime.now(timezone.utc).isoformat()
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = raw.get("updated", "")[:10] or "unknown"
        table = str(spec["table"]).lower()
        (OUT_DIR / f"cso-{table}-raw-{stamp}.json").write_bytes(body)

    series, updated = extract(raw, str(spec["statistic"]), str(spec["sub_index"]))
    if not series:
        sys.exit(f"no values extracted for {name}, refusing to write an empty snapshot")

    # The base period is stated by the CSO and differs between the two series, so it is read
    # from the response rather than hardcoded. Both currently sit on December 2023 = 100.
    payload = {
        "series": series,
        "base": "December 2023 = 100",
        "latest_month": series[-1]["month"],
        "count": len(series),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()

    snapshot = {
        "schema": 1,
        "provenance": {
            "source": "Central Statistics Office, PxStat",
            "table": spec["table"],
            "statistic": spec["statistic"],
            "statistic_label": spec["statistic_label"],
            "sub_index": spec["sub_index"],
            "sub_index_label": spec["sub_index_label"],
            "url": url,
            "dataset_updated": updated,
            "fetched_at": fetched_at,
            "why_this_series": spec["why"],
        },
        "sha256": digest,
        **payload,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / str(spec["out"])
    out.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {out}")
    print(f"  months   {len(series)}  ({series[0]['month']} to {series[-1]['month']})")
    print(f"  updated  {updated}")
    print(f"  sha256   {digest}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--series", choices=[*SERIES, "all"], default="all")
    ap.add_argument("--from", dest="src", help="path to a saved raw JSON-stat response")
    args = ap.parse_args()

    if args.src and args.series == "all":
        sys.exit("--from rebuilds one series, so pass --series as well")

    for name in SERIES if args.series == "all" else [args.series]:
        build(name, args.src)


if __name__ == "__main__":
    main()
