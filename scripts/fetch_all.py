#!/usr/bin/env python3
import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run production, consumption, and price fetchers in parallel."
    )
    parser.add_argument(
        "start_day",
        type=str,
        help="Start day to fetch in yyyy-mm-dd.",
    )
    parser.add_argument(
        "end_day",
        nargs="?",
        type=str,
        help="Optional end day in yyyy-mm-dd (inclusive). If omitted, only start_day is fetched.",
    )
    return parser.parse_args()


def parse_day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(f"Invalid date format: {value}") from exc


def iter_days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def run_script(script: str, day: str) -> subprocess.Popen:
    script_path = Path(__file__).parent / script
    return subprocess.Popen([sys.executable, str(script_path), day])


def main() -> None:
    args = parse_args()
    start_day = parse_day(args.start_day)
    end_day = parse_day(args.end_day) if args.end_day else start_day

    if end_day < start_day:
        raise SystemExit(
            f"end_day ({end_day.isoformat()}) must be on or after start_day ({start_day.isoformat()})"
        )

    exit_code = 0
    for current_day in iter_days(start_day, end_day):
        day_str = current_day.isoformat()
        procs = [
            run_script("fetch_production.py", day_str),
            run_script("fetch_consumption.py", day_str),
            run_script("fetch_prices.py", day_str),
        ]
        for proc in procs:
            proc.wait()
            if proc.returncode != 0:
                exit_code = proc.returncode

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
