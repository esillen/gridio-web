#!/usr/bin/env python3
import argparse
import csv
import json
import re
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

FCR_BASE = "https://mimer.svk.se/PrimaryRegulation/DownloadText"
ESETT_BASE = "https://api.opendata.esett.com"
SE3_MBA = "10Y1001A1001A46L"
OUTPUT_FIELDS = [
    "time",
    "fcrn",
    "day_ahead",
    "imbalance_up",
    "imbalance_down",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch FCR-N auction price and eSett SE3 DA/imbalance prices for one day."
    )
    parser.add_argument(
        "day",
        type=str,
        help="Day to fetch in yyyy-mm-dd.",
    )
    return parser.parse_args()


def parse_float(value: str) -> float:
    text = value.strip()
    if text == "":
        raise ValueError("empty numeric value")
    return float(text.replace(",", "."))


def extract_time_hms(value: str) -> str:
    m = re.search(r"(\d{2}:\d{2}:\d{2})", value)
    return m.group(1) if m else ""


def local_time_hms(value: str) -> str:
    normalized = value.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    return dt.astimezone(ZoneInfo("Europe/Stockholm")).strftime("%H:%M:%S")


def fetch_fcr_csv(period_from: date, period_to: date) -> str:
    params = {
        "periodFrom": period_from.strftime("%m/%d/%Y 00:00:00"),
        "periodTo": period_to.strftime("%m/%d/%Y 00:00:00"),
        "auctionTypeId": 1,
        "productTypeId": 0,
    }
    url = f"{FCR_BASE}?{urlencode(params)}"
    request = Request(
        url,
        headers={
            "User-Agent": "gridio-fetch/1.0",
            "Accept": "text/csv,text/plain,*/*",
        },
    )
    with urlopen(request) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_esett_prices(target_day: date) -> list[dict]:
    local_zone = ZoneInfo("Europe/Stockholm")
    start_local = datetime.combine(target_day, time(0, 0), tzinfo=local_zone)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    end_utc = end_local.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    params = urlencode(
        {
            "start": start_utc,
            "end": end_utc,
            "mba": SE3_MBA,
        }
    )
    url = f"{ESETT_BASE}/EXP14/Prices?{params}"
    request = Request(
        url,
        headers={
            "User-Agent": "gridio-fetch/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(request) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def parse_fcr_n_prices(csv_text: str) -> dict[str, str]:
    csv_text = csv_text.lstrip("\ufeff")
    lines = csv_text.splitlines()
    if not lines:
        return {}

    reader = csv.reader(lines, delimiter=";")
    header = next(reader, [])
    if not header:
        return {}
    header = [h.strip().lstrip("\ufeff") for h in header]
    lowered = [h.lower() for h in header]

    try:
        idx_time = lowered.index("datum")
    except ValueError as exc:
        raise RuntimeError("Could not find required FCR column: Datum") from exc

    try:
        idx_fcr_n_price = lowered.index("fcr-n pris (eur/mw)")
    except ValueError as exc:
        raise RuntimeError("Could not find required FCR column: FCR-N Pris (EUR/MW)") from exc

    out: dict[str, str] = {}
    for row in reader:
        if not row or len(row) <= max(idx_time, idx_fcr_n_price):
            continue
        time_raw = row[idx_time].strip()
        price_raw = row[idx_fcr_n_price].strip()
        if not time_raw or not price_raw:
            continue
        time_hms = extract_time_hms(time_raw)
        if not time_hms:
            continue
        try:
            out[time_hms] = f"{parse_float(price_raw):.5f}"
        except ValueError:
            continue
    return out


def parse_esett_price_rows(rows: list[dict]) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    day_ahead: dict[str, str] = {}
    imbalance_up: dict[str, str] = {}
    imbalance_down: dict[str, str] = {}

    for row in rows:
        ts = row.get("timestamp") or row.get("timestampUTC")
        if not ts:
            continue
        try:
            time_hms = local_time_hms(str(ts))
            imbl_sales = float(row.get("imblSalesPrice") or 0.0)
            imbl_spot_diff = float(row.get("imblSpotDifferencePrice") or 0.0)
        except (ValueError, TypeError):
            continue

        da_price = imbl_sales - imbl_spot_diff
        day_ahead[time_hms] = f"{da_price:.5f}"
        # Single imbalance price from eSett API; use for both directions in current code model.
        imbalance_up[time_hms] = f"{imbl_sales:.5f}"
        imbalance_down[time_hms] = f"{imbl_sales:.5f}"

    return day_ahead, imbalance_up, imbalance_down


def build_rows(
    fcr: dict[str, str],
    day_ahead: dict[str, str],
    imbalance_up: dict[str, str],
    imbalance_down: dict[str, str],
) -> list[dict[str, str]]:
    all_times = sorted(set(fcr) | set(day_ahead) | set(imbalance_up) | set(imbalance_down))
    return [
        {
            "time": t,
            "fcrn": fcr.get(t, ""),
            "day_ahead": day_ahead.get(t, ""),
            "imbalance_up": imbalance_up.get(t, ""),
            "imbalance_down": imbalance_down.get(t, ""),
        }
        for t in all_times
    ]


def main() -> None:
    args = parse_args()
    try:
        target_day = date.fromisoformat(args.day)
    except ValueError as exc:
        raise SystemExit(f"Invalid date format: {args.day}") from exc

    fcr_csv = fetch_fcr_csv(target_day, target_day + timedelta(days=1))
    fcr_prices = parse_fcr_n_prices(fcr_csv)
    esett_rows = fetch_esett_prices(target_day)
    day_ahead_prices, imbalance_up, imbalance_down = parse_esett_price_rows(esett_rows)
    rows = build_rows(fcr_prices, day_ahead_prices, imbalance_up, imbalance_down)

    targets = [
        Path("public/data") / args.day / "prices.csv",
        Path("src/data/real/raw") / args.day / "prices.csv",
    ]
    for output_path in targets:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=OUTPUT_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
