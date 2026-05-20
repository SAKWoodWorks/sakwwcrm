"""
Dry-run: reads local xlsx sample files, prints extracted data.
No DB, no Google Drive needed.

Usage:
    python read_local.py
"""
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Add parent to sys.path so parsers/ is importable
sys.path.insert(0, str(Path(__file__).parent))

from parsers.filename_parser import parse_filename
from parsers.xlsx_parser import parse_tax_invoice, parse_quotation

REPO_ROOT = Path(__file__).parent.parent  # new-crm/

FOLDERS = {
    "tax_invoice": REPO_ROOT / "TAX-Invoices",
    "quotation": REPO_ROOT / "Quoatation",
}


def fmt_money(d):
    return f"฿{float(d):,.2f}"


def process_file(filepath: Path):
    filename = filepath.name
    print(f"\n{'='*70}")
    print(f"FILE: {filename}")

    try:
        meta = parse_filename(filename)
    except ValueError as e:
        print(f"  [SKIP] filename parse error: {e}")
        return

    print(f"  Type       : {meta.doc_type}")
    print(f"  Doc No     : {meta.doc_number}")
    print(f"  Date       : {meta.doc_date}")
    print(f"  Channel    : {meta.channel}")
    print(f"  Salesperson: {meta.salesperson}")
    print(f"  Payment    : {meta.payment_status}")
    print(f"  Ref Doc    : {meta.ref_doc_number or '-'}")
    print(f"  Customer   : {meta.customer_short}  ({meta.province})")

    try:
        if meta.doc_type == "tax_invoice":
            doc = parse_tax_invoice(str(filepath))
        else:
            doc = parse_quotation(str(filepath))
    except Exception as e:
        print(f"  [ERROR] xlsx parse error: {e}")
        return

    print(f"  --- xlsx content ---")
    print(f"  Doc No (xlsx): {doc.doc_number}")
    print(f"  Date raw     : {doc.doc_date_raw}")
    cust = doc.customer
    print(f"  Customer     : {cust.name}")
    print(f"  Tax ID       : {cust.tax_id or '(individual)'}")
    print(f"  Address      : {cust.address or '-'}")
    print(f"  Items ({len(doc.items)}):")
    for item in doc.items:
        print(f"    [{item.line_no}] {item.description[:50]}")
        print(f"         qty={item.quantity} {item.unit}  price={fmt_money(item.unit_price)}  total={fmt_money(item.total)}")
    print(f"  Subtotal: {fmt_money(doc.subtotal)}")
    print(f"  VAT     : {fmt_money(doc.vat)}")
    print(f"  Total   : {fmt_money(doc.total)}")
    if doc.notes:
        print(f"  Notes   : {doc.notes}")


def main():
    all_files = []
    for doc_type, folder in FOLDERS.items():
        if not folder.exists():
            print(f"Folder not found: {folder}")
            continue
        xlsx_files = sorted(folder.glob("*.xlsx"))
        print(f"\nFound {len(xlsx_files)} xlsx files in {folder.name}/")
        all_files.extend(xlsx_files)

    for f in all_files:
        process_file(f)

    print(f"\n{'='*70}")
    print(f"Done. Processed {len(all_files)} files.")


if __name__ == "__main__":
    main()
