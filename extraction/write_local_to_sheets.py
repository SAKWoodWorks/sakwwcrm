"""
One-shot: reads all local xlsx files, pushes rows to Google Sheets.
No DB, no Google Drive needed.

Usage:
    # Set env vars first (or create extraction/.env):
    #   GOOGLE_SERVICE_ACCOUNT_JSON=<json string>
    #   GOOGLE_SHEETS_ID=12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI
    python write_local_to_sheets.py
"""
import io
import os
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from parsers.filename_parser import parse_filename
from parsers.xlsx_parser import parse_tax_invoice, parse_quotation
from sheets_client import ensure_header, batch_append_rows, ensure_items_header, batch_append_items

REPO_ROOT = Path(__file__).parent.parent
FOLDERS = {
    "tax_invoice": REPO_ROOT / "TAX-Invoices",
    "quotation": REPO_ROOT / "Quoatation",
}


def collect_rows():
    rows = []
    item_rows = []
    for doc_type_key, folder in FOLDERS.items():
        if not folder.exists():
            print(f"[warn] folder not found: {folder}")
            continue
        for filepath in sorted(folder.glob("*.xlsx")):
            filename = filepath.name
            try:
                meta = parse_filename(filename)
            except ValueError as e:
                print(f"[skip] {filename}: {e}")
                continue

            try:
                if meta.doc_type == "tax_invoice":
                    doc = parse_tax_invoice(str(filepath))
                else:
                    doc = parse_quotation(str(filepath))
            except Exception as e:
                print(f"[error] {filename}: {e}")
                continue

            rows.append({
                "doc_type": meta.doc_type,
                "doc_number": meta.doc_number,
                "doc_date": meta.doc_date,
                "channel": meta.channel,
                "salesperson": meta.salesperson,
                "customer_name": doc.customer.name,
                "total": float(doc.total),
                "payment_status": meta.payment_status,
                "gdrive_filename": filename,
            })
            for item in doc.items:
                item_rows.append({
                    "doc_number": meta.doc_number,
                    "doc_type": meta.doc_type,
                    "line_no": item.line_no,
                    "description": item.description,
                    "quantity": float(item.quantity),
                    "unit": item.unit,
                    "unit_price": float(item.unit_price),
                    "total": float(item.total),
                })
            print(f"[ok] {filename}  →  {doc.customer.name}  {len(doc.items)} items  ฿{float(doc.total):,.2f}")

    return rows, item_rows


def main():
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")

    print("Collecting rows from local xlsx files...")
    rows, item_rows = collect_rows()

    if not rows:
        print("No rows collected — nothing to write.")
        return

    print(f"\nWriting {len(rows)} document rows + {len(item_rows)} item rows to Google Sheets...")
    ensure_header(sheet_id)
    batch_append_rows(sheet_id, rows)
    ensure_items_header(sheet_id)
    batch_append_items(sheet_id, item_rows)
    print("Done. Check your Google Sheet (Sheet1=Documents, Items=line items).")


if __name__ == "__main__":
    main()
