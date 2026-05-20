"""
Fix apostrophe-prefixed numbers in Sheet1 by rewriting all rows with proper types.

Usage:
  python fix_sheet_numbers.py
  python fix_sheet_numbers.py --dry-run
"""
import argparse
import io
import json
import os
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from sheets_client import _get_service

# Column index (0-based) → type coercion
# doc_type, doc_number, doc_date, channel, salesperson, customer_name, total, payment_status, gdrive_filename
_NUMERIC_COLS = {6}  # total


def _coerce(val, col_idx):
    if col_idx not in _NUMERIC_COLS:
        return val
    try:
        return float(val)
    except (ValueError, TypeError):
        return val


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")
    service = _get_service()

    print("Reading Sheet1...")
    resp = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range="Sheet1",
    ).execute()
    rows = resp.get("values", [])
    print(f"Read {len(rows)} rows (including header)")

    if not rows:
        print("Sheet1 empty, nothing to do.")
        return

    fixed = []
    for i, row in enumerate(rows):
        if i == 0:
            fixed.append(row)  # header — keep as-is
            continue
        fixed.append([_coerce(cell, j) for j, cell in enumerate(row)])

    if args.dry_run:
        print("Dry-run: sample rows after coercion:")
        for r in fixed[1:4]:
            print(" ", r)
        return

    print("Overwriting in place (no clear)...")
    service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": fixed},
    ).execute()

    print(f"Done. {len(fixed) - 1} data rows rewritten.")


if __name__ == "__main__":
    main()
