"""
Backfill all document items from DB to Google Sheets Items tab.

Usage:
  python backfill_items_to_sheets.py
  python backfill_items_to_sheets.py --batch-size 200 --sleep 1.5
  python backfill_items_to_sheets.py --dry-run
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
from sheets_client import ensure_items_header, batch_append_items


def fetch_all_items(conn) -> list[dict]:
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
                p.full_name AS product_name
            FROM document_items di
            JOIN documents d ON di.document_id = d.id
            LEFT JOIN products p ON di.product_id = p.id
            ORDER BY d.id, di.line_no
        """)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--sleep", type=float, default=1.1,
                        help="Seconds between Sheets API calls (60 req/min limit)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_url = os.environ["DATABASE_URL"]
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")

    conn = psycopg2.connect(db_url)
    print("Fetching items from DB...")
    rows = fetch_all_items(conn)
    conn.close()

    total = len(rows)
    print(f"Found {total} items across all documents")

    if args.dry_run:
        for r in rows[:5]:
            print(r)
        print(f"  ... (dry-run, showing first 5 of {total})")
        return

    ensure_items_header(sheet_id)
    print("Items tab header ensured")

    batches = [rows[i:i + args.batch_size] for i in range(0, total, args.batch_size)]
    print(f"Writing {total} items in {len(batches)} batches of {args.batch_size}")

    written = 0
    for idx, batch in enumerate(batches, 1):
        # Convert Decimal/date types to plain Python for Sheets
        clean = []
        for r in batch:
            clean.append({
                "doc_number": r["doc_number"],
                "doc_type": r["doc_type"],
                "line_no": r["line_no"],
                "description": r["description"],
                "quantity": float(r["quantity"]),
                "unit": r["unit"] or "",
                "unit_price": float(r["unit_price"]),
                "total": float(r["total"]),
                "sku_code": r["sku_code"] or "",
                "product_name": r["product_name"] or "",
            })
        batch_append_items(sheet_id, clean)
        written += len(batch)
        print(f"  [{idx}/{len(batches)}] wrote {written}/{total}")
        if idx < len(batches):
            time.sleep(args.sleep)

    print(f"Done. {written} items written to Sheets Items tab.")


if __name__ == "__main__":
    main()
