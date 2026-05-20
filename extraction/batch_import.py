"""
Batch import all xlsx files from Google Drive folders into PostgreSQL + Google Sheets.

Usage:
  python batch_import.py --folder tax_invoices
  python batch_import.py --folder quotations
  python batch_import.py --all
  python batch_import.py --all --year 2026
  python batch_import.py --local        # import all local sample files (no Drive)
"""
import argparse
import csv
import io
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from db import is_already_synced
from extract_file import process, process_local

REPO_ROOT = Path(__file__).parent.parent
LOCAL_FOLDERS = {
    "tax_invoices": REPO_ROOT / "TAX-Invoices",
    "quotations": REPO_ROOT / "Quoatation",
}


def run_local():
    """Import all local sample xlsx files."""
    total = skipped = success = error = 0
    errors = []

    for folder_key, folder in LOCAL_FOLDERS.items():
        if not folder.exists():
            print(f"[warn] folder not found: {folder}")
            continue
        files = sorted(folder.glob("*.xlsx"))
        print(f"\n{folder_key}: {len(files)} files")
        for filepath in files:
            total += 1
            try:
                process_local(str(filepath))
                success += 1
            except SystemExit:
                error += 1
                errors.append({"filename": filepath.name, "error": "process failed"})

    _print_summary(total, success, skipped, error, errors, "local")


def run_drive(folder_key: str, year_filter: int = None):
    from gdrive_client import list_files_in_folder

    folder_ids = json.loads(os.environ["GOOGLE_DRIVE_FOLDER_IDS"])
    folder_id = folder_ids[folder_key]

    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)

    files = list(list_files_in_folder(folder_id))
    total = len(files)
    print(f"Found {total} files in {folder_key}")

    skipped = success = error = 0
    errors = []

    for i, f in enumerate(files, 1):
        file_id = f["id"]
        filename = f["name"]

        if year_filter and str(year_filter) not in filename:
            skipped += 1
            continue

        if is_already_synced(conn, file_id):
            skipped += 1
            print(f"[{i}/{total}] skip {filename}")
            continue

        print(f"[{i}/{total}] {filename}")
        try:
            from extract_file import process_drive
            process_drive(file_id, filename)
            success += 1
        except SystemExit:
            error += 1
            errors.append({"file_id": file_id, "filename": filename})
        except Exception as e:
            error += 1
            errors.append({"file_id": file_id, "filename": filename, "error": str(e)})

        time.sleep(0.1)  # Drive API rate limit

    conn.close()
    _print_summary(total, success, skipped, error, errors, folder_key)


def _print_summary(total, success, skipped, error, errors, label):
    print(f"\n--- {label} ---")
    print(f"total={total}  success={success}  skip={skipped}  error={error}")
    if errors:
        report = f"error_report_{label}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        with open(report, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["file_id", "filename", "error"])
            w.writeheader()
            w.writerows(errors)
        print(f"Error report: {report}")


if __name__ == "__main__":
    if not isinstance(sys.stdout, io.TextIOWrapper) or sys.stdout.encoding.lower() != "utf-8":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--folder", choices=["tax_invoices", "quotations"])
    group.add_argument("--all", action="store_true")
    group.add_argument("--local", action="store_true", help="Import local sample files")
    group.add_argument("--local-folder", metavar="PATH", help="Import all xlsx from a specific local folder")
    parser.add_argument("--year", type=int)
    args = parser.parse_args()

    if args.local:
        run_local()
    elif args.local_folder:
        folder = Path(args.local_folder)
        files = sorted(folder.rglob("*.xlsx"))
        total = skipped = success = error = 0
        errors = []
        print(f"{len(files)} files in {folder}")
        for filepath in files:
            total += 1
            # Use subfolder name as salesperson if file is one level deep inside root folder
            salesperson_override = filepath.parent.name if filepath.parent != folder else None
            try:
                process_local(str(filepath), salesperson_override=salesperson_override)
                success += 1
            except SystemExit:
                error += 1
                errors.append({"filename": filepath.name, "error": "process failed"})
        _print_summary(total, success, skipped, error, errors, folder.name)
    elif args.all:
        run_drive("tax_invoices", args.year)
        run_drive("quotations", args.year)
    else:
        run_drive(args.folder, args.year)
