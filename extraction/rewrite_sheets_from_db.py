"""
Clear and rewrite both Sheet1 (documents) and Items tab from DB.
Fixes number format and adds product columns to Items.

Usage:
  python rewrite_sheets_from_db.py
  python rewrite_sheets_from_db.py --dry-run
  python rewrite_sheets_from_db.py --tab sheet1   # only Sheet1
  python rewrite_sheets_from_db.py --tab items    # only Items
"""
import argparse
import io
import os
import sys
import time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from sheets_client import _get_service, _HEADER, _ITEMS_HEADER


def fetch_documents(conn) -> list:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                d.doc_type,
                d.doc_number,
                d.doc_date,
                d.channel,
                s.name AS salesperson,
                c.name AS customer_name,
                d.subtotal,
                d.vat,
                d.total,
                d.payment_status,
                d.gdrive_filename
            FROM documents d
            LEFT JOIN salespersons s ON d.salesperson_id = s.id
            LEFT JOIN customers c ON d.customer_id = c.id
            ORDER BY d.doc_date, d.id
        """)
        return cur.fetchall()


def fetch_items(conn) -> list:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                d.doc_number,
                d.doc_type,
                di.line_no,
                di.description,
                di.quantity,
                di.unit,
                di.unit_price,
                di.total,
                p.sku_code,
                p.full_name
            FROM document_items di
            JOIN documents d ON di.document_id = d.id
            LEFT JOIN products p ON di.product_id = p.id
            ORDER BY d.doc_date, d.id, di.line_no
        """)
        return cur.fetchall()


def rewrite_sheet1(service, sheet_id: str, rows: list, dry_run: bool):
    values = [_HEADER[0]]
    for r in rows:
        values.append([
            r[0],           # doc_type
            r[1],           # doc_number
            r[2].strftime("%d/%m/%Y") if hasattr(r[2], "strftime") else str(r[2]),  # doc_date
            r[3] or "",     # channel
            r[4] or "",     # salesperson
            r[5] or "",     # customer_name
            float(r[6]) if r[6] is not None else "",  # subtotal
            float(r[7]) if r[7] is not None else "",  # vat
            float(r[8]) if r[8] is not None else "",  # total
            r[9] or "",     # payment_status
            r[10] or "",    # gdrive_filename
        ])

    print(f"Sheet1: {len(values) - 1} documents")
    if dry_run:
        for v in values[1:4]:
            print(" ", v)
        return

    service.spreadsheets().values().clear(
        spreadsheetId=sheet_id, range="Sheet1"
    ).execute()
    service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range="Sheet1!A1",
        valueInputOption="RAW",
        body={"values": values},
    ).execute()
    print("Sheet1 done.")


def rewrite_items(service, sheet_id: str, rows: list, dry_run: bool, batch_size: int = 500):
    header = _ITEMS_HEADER[0]
    all_values = []
    for r in rows:
        all_values.append([
            r[0],                                          # doc_number
            r[1],                                          # doc_type
            r[2],                                          # line_no
            r[3] or "",                                    # description
            float(r[4]) if r[4] is not None else 0.0,     # quantity
            r[5] or "",                                    # unit
            float(r[6]) if r[6] is not None else 0.0,     # unit_price
            float(r[7]) if r[7] is not None else 0.0,     # total
            r[8] or "",                                    # sku_code
            r[9] or "",                                    # product_name
        ])

    print(f"Items: {len(all_values)} rows")
    if dry_run:
        for v in all_values[:4]:
            print(" ", v)
        return

    # Clear Items tab (creates if missing via append after clear)
    try:
        service.spreadsheets().values().clear(
            spreadsheetId=sheet_id, range="Items"
        ).execute()
    except Exception:
        pass  # tab may not exist yet

    # Write header first
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range="Items!A1",
        valueInputOption="RAW",
        body={"values": [header]},
    ).execute()

    # Write data in batches (60 req/min limit)
    batches = [all_values[i:i + batch_size] for i in range(0, len(all_values), batch_size)]
    written = 0
    for idx, batch in enumerate(batches, 1):
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range="Items!A1",
            valueInputOption="RAW",
            body={"values": batch},
        ).execute()
        written += len(batch)
        print(f"  Items [{idx}/{len(batches)}] {written}/{len(all_values)}")
        if idx < len(batches):
            time.sleep(1.1)

    print("Items done.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--tab", choices=["sheet1", "items", "both"], default="both")
    args = parser.parse_args()

    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")
    db_url = os.environ["DATABASE_URL"]

    conn = psycopg2.connect(db_url)
    service = _get_service()

    try:
        if args.tab in ("sheet1", "both"):
            print("Fetching documents...")
            docs = fetch_documents(conn)
            rewrite_sheet1(service, sheet_id, docs, args.dry_run)

        if args.tab in ("items", "both"):
            print("Fetching items...")
            items = fetch_items(conn)
            rewrite_items(service, sheet_id, items, args.dry_run)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
