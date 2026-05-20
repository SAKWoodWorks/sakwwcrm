"""Export all products from DB to Google Sheets 'Products' tab."""
import os
import time
import psycopg2
from dotenv import load_dotenv
from sheets_client import _get_service, _fmt_date

load_dotenv()

HEADER = [[
    "sku_code", "full_name", "category", "grade",
    "thickness", "width", "length", "weight", "volume",
    "ws_cost", "rt_cost",
    "total_qty_invoiced", "total_amount_invoiced",
    "total_qty_quoted", "total_amount_quoted",
    "date_last_invoice",
]]

TAB = "Products"


def _ensure_tab(service, sheet_id: str) -> None:
    meta = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    existing = [s["properties"]["title"] for s in meta["sheets"]]
    if TAB not in existing:
        service.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": TAB}}}]},
        ).execute()
        print(f"Created tab '{TAB}'")
    else:
        print(f"Tab '{TAB}' exists, clearing...")
        service.spreadsheets().values().clear(
            spreadsheetId=sheet_id, range=f"{TAB}!A:Z"
        ).execute()


def _fetch_products(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                sku_code, full_name, category, grade,
                thickness, width, length, weight, volume,
                ws_cost, rt_cost,
                total_qty_invoiced, total_amount_invoiced,
                total_qty_quoted, total_amount_quoted,
                date_last_invoice
            FROM products
            ORDER BY category, full_name
        """)
        return cur.fetchall()


def _to_row(r):
    def f(v):
        if v is None:
            return ""
        if hasattr(v, "strftime"):
            return _fmt_date(v)
        try:
            return float(v)
        except (TypeError, ValueError):
            return str(v)
    return [f(v) for v in r]


def main():
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID", "12jWo3Ra4L_jvL72o6Jbhq7E0bD0RQqNUfQRft-ZqwpI")
    db_url = os.environ["DATABASE_URL"]

    service = _get_service()
    _ensure_tab(service, sheet_id)

    conn = psycopg2.connect(db_url)
    rows = _fetch_products(conn)
    conn.close()
    print(f"Products: {len(rows)}")

    values = HEADER + [_to_row(r) for r in rows]

    # Write in one batch (products are small enough)
    service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=f"{TAB}!A1",
        valueInputOption="RAW",
        body={"values": values},
    ).execute()
    time.sleep(1.1)

    print(f"Done. Wrote {len(rows)} products to '{TAB}' tab.")


if __name__ == "__main__":
    main()
