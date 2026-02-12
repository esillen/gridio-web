#!/usr/bin/env python3
import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run production, consumption, and price fetchers in parallel."
    )
    parser.add_argument(
        "day",
        type=str,
        help="Day to fetch in yyyy-mm-dd.",
    )
    return parser.parse_args()


def run_script(script: str, day: str) -> subprocess.Popen:
    script_path = Path(__file__).parent / script
    return subprocess.Popen([sys.executable, str(script_path), day])


def main() -> None:
    args = parse_args()
    procs = [
        run_script("fetch_production.py", args.day),
        run_script("fetch_consumption.py", args.day),
        run_script("fetch_prices.py", args.day),
    ]

    exit_code = 0
    for proc in procs:
        proc.wait()
        if proc.returncode != 0:
            exit_code = proc.returncode

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
