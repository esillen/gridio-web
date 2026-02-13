#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path

OUTPUT_FIELDS = ["time", "frequency"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Split frequency_data CSV into per-day frequency.csv files under public/data/YYYY-MM-DD."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("frequency_data/frequency_data.csv"),
        help="Input CSV path (default: frequency_data/frequency_data.csv).",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("public/data"),
        help="Output root directory (default: public/data).",
    )
    return parser.parse_args()


def split_timestamp(value: str) -> tuple[str, str]:
    raw = value.strip()
    if "T" not in raw:
        raise ValueError(f"Invalid timestamp format: {value}")
    day, time_part = raw.split("T", 1)
    return day, time_part[:8]


def main() -> None:
    args = parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input file does not exist: {args.input}")

    writers: dict[str, csv.DictWriter] = {}
    open_files: dict[str, object] = {}
    rows_by_day: dict[str, int] = {}
    bad_rows = 0

    with args.input.open("r", newline="", encoding="utf-8") as source_file:
        reader = csv.DictReader(source_file)
        required = {"timestamp_fixed", "frequency"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise SystemExit(
                "Input CSV must include columns: timestamp_fixed, frequency"
            )

        for row in reader:
            timestamp = (row.get("timestamp_fixed") or "").strip()
            frequency = (row.get("frequency") or "").strip()
            if not timestamp:
                bad_rows += 1
                continue
            try:
                day, time_hms = split_timestamp(timestamp)
            except ValueError:
                bad_rows += 1
                continue

            writer = writers.get(day)
            if writer is None:
                output_dir = args.output_root / day
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / "frequency.csv"
                file_handle = output_path.open("w", newline="", encoding="utf-8")
                open_files[day] = file_handle
                writer = csv.DictWriter(
                    file_handle, fieldnames=OUTPUT_FIELDS, lineterminator="\n"
                )
                writer.writeheader()
                writers[day] = writer
                rows_by_day[day] = 0

            writer.writerow({"time": time_hms, "frequency": frequency})
            rows_by_day[day] += 1

    for file_handle in open_files.values():
        file_handle.close()

    for day in sorted(rows_by_day):
        print(f"Wrote {rows_by_day[day]} rows to {args.output_root / day / 'frequency.csv'}")
    if bad_rows:
        print(f"Skipped {bad_rows} malformed rows")


if __name__ == "__main__":
    main()
