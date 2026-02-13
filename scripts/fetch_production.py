#!/usr/bin/env python3
import argparse
import csv
import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

API_BASE = "https://api.opendata.esett.com"
MBA_CODES = [
    "10Y1001A1001A44P",  # SE1
    "10Y1001A1001A45N",  # SE2
    "10Y1001A1001A46L",  # SE3
    "10Y1001A1001A47J",  # SE4
]
OUTPUT_FIELDS = [
    "time",
    "hydro",
    "nuclear",
    "solar",
    "thermal",
    "wind",
    "wind_offshore",
    "energy_storage",
    "other",
    "total",
]


def local_time_hms(value: str) -> str:
    if not value:
        return ""
    normalized = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        return value[-8:] if len(value) >= 8 else ""
    return dt.strftime("%H:%M:%S")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Swedish production data and write a 15-minute CSV."
    )
    parser.add_argument(
        "day",
        type=str,
        help="Day to fetch in yyyy-mm-dd (interpreted in Europe/Stockholm).",
    )
    return parser.parse_args()


def to_iso_millis(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fetch_production(start_utc: datetime, end_utc: datetime) -> List[dict]:
    params = {
        "start": to_iso_millis(start_utc),
        "end": to_iso_millis(end_utc),
        "mba": MBA_CODES,
    }
    url = f"{API_BASE}/EXP16/Volumes?{urlencode(params, doseq=True)}"
    with urlopen(url) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def merge_rows(rows: List[dict]) -> Dict[str, Dict[str, float]]:
    merged: Dict[str, Dict[str, float]] = {}
    for row in rows:
        ts_utc = row.get("timestampUTC")
        if not ts_utc:
            continue
        bucket = merged.setdefault(
            ts_utc,
            {
                "time": "",
                "hydro": 0.0,
                "nuclear": 0.0,
                "solar": 0.0,
                "thermal": 0.0,
                "wind": 0.0,
                "wind_offshore": 0.0,
                "energy_storage": 0.0,
                "other": 0.0,
                "total": 0.0,
            },
        )
        bucket["time"] = local_time_hms(row.get("timestamp") or "")
        bucket["hydro"] += float(row.get("hydro") or 0.0)
        bucket["nuclear"] += float(row.get("nuclear") or 0.0)
        bucket["solar"] += float(row.get("solar") or 0.0)
        bucket["thermal"] += float(row.get("thermal") or 0.0)
        bucket["wind"] += float(row.get("wind") or 0.0)
        bucket["wind_offshore"] += float(row.get("windOffshore") or 0.0)
        bucket["energy_storage"] += float(row.get("energyStorage") or 0.0)
        bucket["other"] += float(row.get("other") or 0.0)
        bucket["total"] += float(row.get("total") or 0.0)
    return merged


def main() -> None:
    args = parse_args()
    try:
        target_day = date.fromisoformat(args.day)
    except ValueError as exc:
        raise SystemExit(f"Invalid date format: {args.day}") from exc

    local_zone = ZoneInfo("Europe/Stockholm")
    start_local = datetime.combine(target_day, time(0, 0), tzinfo=local_zone)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)

    rows = fetch_production(start_utc, end_utc)
    merged = merge_rows(rows)
    ordered = [merged[key] for key in sorted(merged.keys())]

    targets = [
        Path("public/data") / args.day / "production.csv",
        Path("src/data/real/raw") / args.day / "production.csv",
    ]
    for output_path in targets:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=OUTPUT_FIELDS)
            writer.writeheader()
            writer.writerows(ordered)
        print(f"Wrote {len(ordered)} rows to {output_path}")


if __name__ == "__main__":
    main()
