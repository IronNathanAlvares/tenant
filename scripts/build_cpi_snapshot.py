"""Build a pinned CPI snapshot from CSO PxStat table CPM24.

The RTB Rent Calculator page names its source as "All-Items Consumer Price Index (CPI),
Ireland (CSO CPM24C01 PxStat)", so that is the series we take: statistic CPM24C01,
sub index CP00 (All Items).

Do not switch this to CPM01. CPM01 looks right, is stale, and uses a different sub index
scheme. See docs/adr/ADR-0003-pinned-cpi-snapshots.md.

Usage:
    python scripts/build_cpi_snapshot.py              # fetch live
    python scripts/build_cpi_snapshot.py --from FILE  # rebuild from a saved raw response
"""

import argparse
import hashlib
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

TABLE = "CPM24"
STATISTIC = "CPM24C01"
SUBINDEX = "CP00"
URL = (
    "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/"
    f"{TABLE}/JSON-stat/2.0/en"
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "cpi"


def index_map(dimension: dict) -> dict[str, int]:
    idx = dimension["category"]["index"]
    return idx if isinstance(idx, dict) else {k: i for i, k in enumerate(idx)}


def extract(raw: dict) -> tuple[list[dict], str]:
    dims = raw["dimension"]
    dim_ids = raw["id"]
    size = raw["size"]
    values = raw["value"]

    maps = [index_map(dims[d]) for d in dim_ids]
    stat_dim, time_dim, sub_dim = 0, 1, 2

    if STATISTIC not in maps[stat_dim]:
        sys.exit(f"statistic {STATISTIC} not present, table layout changed")
    if SUBINDEX not in maps[sub_dim]:
        sys.exit(f"sub index {SUBINDEX} not present, table layout changed")

    s = maps[stat_dim][STATISTIC]
    c = maps[sub_dim][SUBINDEX]

    series = []
    for month, t in sorted(maps[time_dim].items()):
        flat = (s * size[time_dim] + t) * size[sub_dim] + c
        v = values[flat] if isinstance(values, list) else values.get(str(flat))
        if v is None:
            continue
        series.append({"month": f"{month[:4]}-{month[4:]}", "value": v})

    return series, raw.get("updated", "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", help="path to a saved raw JSON-stat response")
    args = ap.parse_args()

    if args.src:
        raw = json.loads(pathlib.Path(args.src).read_text(encoding="utf-8"))
        fetched_at = None
    else:
        with urllib.request.urlopen(URL, timeout=60) as r:
            body = r.read()
        raw = json.loads(body)
        fetched_at = datetime.now(timezone.utc).isoformat()
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = raw.get("updated", "")[:10] or "unknown"
        (OUT_DIR / f"cso-cpm24-raw-{stamp}.json").write_bytes(body)

    series, updated = extract(raw)
    if not series:
        sys.exit("no values extracted, refusing to write an empty snapshot")

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
            "table": TABLE,
            "statistic": STATISTIC,
            "statistic_label": "Consumer Price Index",
            "sub_index": SUBINDEX,
            "sub_index_label": "All Items",
            "url": URL,
            "dataset_updated": updated,
            "fetched_at": fetched_at,
            "why_this_series": (
                "The RTB Rent Calculator page names CSO CPM24C01 PxStat as its source. "
                "Section 19(4)(b) RTA 2004 as amended defines the CPI number by "
                "reference to the table the RTB publishes under section 19(4C)(b)."
            ),
        },
        "sha256": digest,
        **payload,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "cpi-all-items.json"
    out.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {out}")
    print(f"  months   {len(series)}  ({series[0]['month']} to {series[-1]['month']})")
    print(f"  updated  {updated}")
    print(f"  sha256   {digest}")


if __name__ == "__main__":
    main()
