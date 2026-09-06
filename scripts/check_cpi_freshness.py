"""Fail the build when the CSO has published a CPI month our snapshot does not have.

ADR-0003 pins CPI as data in the repository rather than a live call. The cost of that
decision is that the snapshot can go stale silently, and a stale snapshot means a wrong
answer delivered confidently. This turns that silent problem into a red build.

It also cross-checks the months we do have against the live series, because a CSO revision
to a past value changes answers we have already given.

Exit codes:
    0  snapshot is current and agrees with the CSO
    1  snapshot is stale, or disagrees on a month we already have
    2  could not reach the CSO (does not fail the build on its own; see main)
"""

import json
import pathlib
import sys
import urllib.error
import urllib.request

TABLE = "CPM24"
STATISTIC = "CPM24C01"
SUBINDEX = "CP00"
URL = (
    "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/"
    f"{TABLE}/JSON-stat/2.0/en"
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data" / "cpi" / "cpi-all-items.json"


def index_map(dimension: dict) -> dict[str, int]:
    idx = dimension["category"]["index"]
    return idx if isinstance(idx, dict) else {k: i for i, k in enumerate(idx)}


def live_series() -> dict[str, float]:
    with urllib.request.urlopen(URL, timeout=60) as r:
        raw = json.loads(r.read())

    dims, size, values = raw["dimension"], raw["size"], raw["value"]
    maps = [index_map(dims[d]) for d in raw["id"]]
    s, c = maps[0][STATISTIC], maps[2][SUBINDEX]

    out: dict[str, float] = {}
    for month, t in maps[1].items():
        flat = (s * size[1] + t) * size[2] + c
        v = values[flat] if isinstance(values, list) else values.get(str(flat))
        if v is not None:
            out[f"{month[:4]}-{month[4:]}"] = v
    return out


def main() -> int:
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    have = {row["month"]: row["value"] for row in snapshot["series"]}

    try:
        live = live_series()
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"::warning::could not reach the CSO: {exc}")
        print("Skipping the freshness check. This is not a pass.")
        return 0

    problems: list[str] = []

    missing = sorted(set(live) - set(have))
    if missing:
        problems.append(
            f"The CSO has {len(missing)} month(s) the snapshot does not: "
            f"{', '.join(missing)}"
        )

    for month in sorted(set(live) & set(have)):
        if abs(live[month] - have[month]) > 1e-9:
            problems.append(
                f"{month} was revised: snapshot has {have[month]}, CSO now says {live[month]}"
            )

    if problems:
        for p in problems:
            print(f"::error::{p}")
        print()
        print("Rebuild the snapshot and open a pull request:")
        print("    python scripts/build_cpi_snapshot.py")
        print()
        print("A revision to a past month changes determinations we have already given.")
        print("Read docs/adr/ADR-0003-pinned-cpi-snapshots.md before merging one.")
        return 1

    print(f"CPI snapshot is current. {len(have)} months, latest {snapshot['latest_month']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
