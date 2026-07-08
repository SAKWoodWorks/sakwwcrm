"""
Usage:
  # Local file (no Drive needed):
  python extract_file.py --local-path "D:/Works/Web/crm/new-crm/TAX-Invoices/TI_B No 256V..."

  # Google Drive file:
  python extract_file.py --file-id DRIVE_FILE_ID --filename "TI_B No 256V..."
  python extract_file.py --file-id DRIVE_FILE_ID   # filename fetched from Drive
"""
import argparse
import io
import os
import sys
import tempfile
import traceback
from datetime import date, datetime
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import psycopg2
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from db import (
    is_already_synced, upsert_salesperson, upsert_customer,
    insert_document, insert_document_items, log_sync, fetch_products_by_ids,
)
from parsers.filename_parser import parse_filename
from parsers.province_parser import extract_province_from_address
from parsers.xlsx_parser import parse_tax_invoice, parse_quotation
from product_matcher import match_product_id
from sheets_client import append_document_row, batch_append_items, ensure_items_header


def _to_gregorian(raw) -> date:
    """Convert Thai Buddhist Era date (year > 2500) to Gregorian."""
    if isinstance(raw, (date, datetime)):
        y = raw.year
        if y > 2500:
            return raw.replace(year=y - 543) if isinstance(raw, date) else raw.replace(year=y - 543).date()
        return raw if isinstance(raw, date) else raw.date()
    if isinstance(raw, str) and "/" in raw:
        d, m, y = raw.split("/")
        year = int(y)
        if year > 2500:
            year -= 543
        return date(year, int(m), int(d))
    return None


def process(filepath: str, filename: str, file_id: str, dry_run: bool = False, salesperson_override: str = None) -> None:
    db_url = os.environ["DATABASE_URL"]
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        if is_already_synced(conn, file_id):
            print(f"[skip] already synced: {filename}")
            conn.close()
            return

        meta = parse_filename(filename)
        if salesperson_override:
            meta.salesperson = salesperson_override

        if meta.doc_type == "tax_invoice":
            doc_data = parse_tax_invoice(filepath)
        else:
            doc_data = parse_quotation(filepath)

        doc_date = _to_gregorian(doc_data.doc_date_raw) or meta.doc_date

        if dry_run:
            print(f"[dry-run] {filename}")
            print(f"  customer: {doc_data.customer.name} ({doc_data.customer.tax_id})")
            print(f"  date: {doc_date}  total: ฿{float(doc_data.total):,.2f}")
            for item in doc_data.items:
                print(f"  [{item.line_no}] {item.description[:50]}  qty={item.quantity} {item.unit}  ฿{float(item.total):,.2f}")
            conn.close()
            return

        sp_id = upsert_salesperson(conn, meta.salesperson, meta.channel) if meta.salesperson else None
        province = extract_province_from_address(doc_data.customer.address)
        cust_id = upsert_customer(conn, doc_data.customer, province)
        product_ids = [match_product_id(conn, item.description) for item in doc_data.items]
        product_info = fetch_products_by_ids(conn, product_ids)

        effective_doc_type = meta.doc_type
        if meta.doc_type == "tax_invoice" and not (doc_data.customer.name or "").strip():
            effective_doc_type = "abb_invoice"

        doc_id = insert_document(conn, {
            "doc_type": effective_doc_type,
            "doc_number": meta.doc_number,
            "doc_date": doc_date,
            "channel": meta.channel,
            "salesperson_id": sp_id,
            "payment_status": meta.payment_status,
            "ref_doc_number": meta.ref_doc_number,
            "customer_id": cust_id,
            "subtotal": float(doc_data.subtotal),
            "vat": float(doc_data.vat),
            "total": float(doc_data.total),
            "notes": doc_data.notes,
            "gdrive_file_id": file_id,
            "gdrive_filename": filename,
        })

        insert_document_items(conn, doc_id, doc_data.items, product_ids)
        conn.commit()

        ensure_items_header(sheet_id)
        append_document_row(sheet_id, {
            "doc_type": effective_doc_type,
            "doc_number": meta.doc_number,
            "doc_date": doc_date,
            "channel": meta.channel,
            "salesperson": meta.salesperson,
            "customer_name": doc_data.customer.name,
            "subtotal": float(doc_data.subtotal),
            "vat": float(doc_data.vat),
            "total": float(doc_data.total),
            "payment_status": meta.payment_status,
            "gdrive_filename": filename,
        })

        batch_append_items(sheet_id, [
            {
                "doc_number": meta.doc_number,
                "doc_type": meta.doc_type,
                "line_no": item.line_no,
                "description": item.description,
                "quantity": float(item.quantity),
                "unit": item.unit,
                "unit_price": float(item.unit_price),
                "total": float(item.total),
                "sku_code": product_info.get(product_ids[i], {}).get("sku_code", ""),
                "product_name": product_info.get(product_ids[i], {}).get("full_name", ""),
            }
            for i, item in enumerate(doc_data.items)
        ])

        log_sync(conn, file_id, filename, "success", None)
        print(f"[ok] {filename}  →  doc_id={doc_id}  customer={doc_data.customer.name}  ฿{float(doc_data.total):,.2f}")

    except Exception as e:
        conn.rollback()
        try:
            log_sync(conn, file_id, filename, "error", str(e))
        except Exception:
            pass
        print(f"[error] {filename}: {e}", file=sys.stderr)
        traceback.print_exc()
        conn.close()
        sys.exit(1)

    finally:
        conn.close()


def process_local(local_path: str, dry_run: bool = False, salesperson_override: str = None) -> None:
    filepath = str(Path(local_path).resolve())
    filename = Path(local_path).name
    file_id = f"local::{filename}"
    process(filepath, filename, file_id, dry_run=dry_run, salesperson_override=salesperson_override)


def process_drive(file_id: str, filename: str, dry_run: bool = False) -> None:
    from gdrive_client import download_file, get_file_name
    if not filename:
        filename = get_file_name(file_id)
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        download_file(file_id, tmp_path)
        process(tmp_path, filename, file_id, dry_run=dry_run)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--local-path", help="Path to local xlsx file")
    group.add_argument("--file-id", help="Google Drive file ID")
    parser.add_argument("--filename", help="Original filename (optional with --file-id; fetched from Drive if omitted)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB/Sheets write")
    args = parser.parse_args()

    if args.local_path:
        process_local(args.local_path, dry_run=args.dry_run)
    else:
        process_drive(args.file_id, args.filename, dry_run=args.dry_run)
