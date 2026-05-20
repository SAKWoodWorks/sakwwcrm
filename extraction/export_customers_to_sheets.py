"""Export all customers from DB to Google Sheets 'Customers' tab."""
import os
import re
import time
import psycopg2
from dotenv import load_dotenv
from sheets_client import _get_service, _fmt_date

load_dotenv()

HEADER = [[
    "id", "name", "tax_id", "type", "status", "is_regular", "province", "address",
    "salesperson", "phone", "email", "line_id",
    "total_invoiced", "invoice_count", "last_invoice_date",
]]

_PHONE_RE = re.compile(r'(?:โทร\.?|[Tt]el\.?)\s*([\d\-\+,\./\s]+)')

def _extract_phone(address: str) -> str:
    if not address:
        return ""
    m = _PHONE_RE.search(address)
    if not m:
        return ""
    raw = m.group(1)
    clean = re.split(r'[^\d\-\+,\./\s]', raw)[0].strip().rstrip(',')
    return clean

TAB = "Customers"
BATCH = 500


def _ensure_tab(service, sheet_id: str, min_rows: int = 5000) -> None:
    meta = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = {s["properties"]["title"]: s for s in meta["sheets"]}
    requests = []
    if TAB not in existing:
        requests.append({"addSheet": {"properties": {"title": TAB, "gridProperties": {"rowCount": min_rows, "columnCount": 26}}}})
        print(f"Created tab '{TAB}'")
    else:
        sheet_info = existing[TAB]
        sheet_id_int = sheet_info["properties"]["sheetId"]
        current_rows = sheet_info["properties"]["gridProperties"]["rowCount"]
        service.spreadsheets().values().clear(
            spreadsheetId=sheet_id, range=f"{TAB}!A:Z"
        ).execute()
        print(f"Tab '{TAB}' exists, clearing...")
        if current_rows < min_rows:
            requests.append({"updateSheetProperties": {
                "properties": {"sheetId": sheet_id_int, "gridProperties": {"rowCount": min_rows}},
                "fields": "gridProperties.rowCount",
            }})
    if requests:
        service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={"requests": requests}).execute()


def _fetch_customers(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                c.id, c.name, c.tax_id, c.type, c.status, c.province, c.address,
                s.name AS salesperson, c.phone, c.email, c.line_id,
                COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0) AS total_invoiced,
                COUNT(d.id) FILTER (WHERE d.doc_type = 'tax_invoice')             AS invoice_count,
                MAX(d.doc_date) FILTER (WHERE d.doc_type = 'tax_invoice')         AS last_invoice_date
            FROM customers c
            LEFT JOIN salespersons s ON s.id = c.salesperson_id
            LEFT JOIN documents d ON d.customer_id = c.id
            GROUP BY c.id, c.name, c.tax_id, c.type, c.status, c.province, c.address,
                     s.name, c.phone, c.email, c.line_id
            ORDER BY c.name
        """)
        return cur.fetchall()


def _to_row(r):
    import math
    # r: id, name, tax_id, type, status, province, address, salesperson, phone, email, line_id, total_invoiced, invoice_count, last_invoice_date
    address = r[6] or ""

    def f(v):
        if v is None:
            return ""
        if hasattr(v, "strftime"):
            return _fmt_date(v)
        try:
            result = float(v)
            return 0 if (math.isnan(result) or math.isinf(result)) else result
        except (TypeError, ValueError):
            return str(v)

    row = [f(v) for v in r]
    # invoice_count is index 12 (before is_regular insert)
    invoice_count = r[12] or 0
    is_regular = "ใช่" if int(invoice_count) > 2 else ""

    # insert is_regular after status (index 5)
    row.insert(5, is_regular)

    # phone is now index 9 — use DB value if present, else extract from address
    if not row[9]:
        row[9] = _extract_phone(address)
    return row


def main():
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")
    db_url = os.environ["DATABASE_URL"]

    service = _get_service()
    _ensure_tab(service, sheet_id)

    conn = psycopg2.connect(db_url)
    rows = _fetch_customers(conn)
    conn.close()
    print(f"Customers: {len(rows)}")

    all_values = HEADER + [_to_row(r) for r in rows]
    for i in range(0, len(all_values), BATCH):
        chunk = all_values[i:i + BATCH]
        start_row = i + 1
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range=f"{TAB}!A{start_row}",
            valueInputOption="RAW",
            body={"values": chunk},
        ).execute()
        print(f"  [{i // BATCH + 1}] {min(i + BATCH, len(all_values))}/{len(all_values)}")
        time.sleep(1.1)

    print(f"Done. Wrote {len(rows)} customers to '{TAB}' tab.")


if __name__ == "__main__":
    main()
