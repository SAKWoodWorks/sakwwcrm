import json
import os
from typing import List
from google.oauth2 import service_account
from googleapiclient.discovery import build

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def _fmt_date(d) -> str:
    if hasattr(d, "strftime"):
        return d.strftime("%d/%m/%Y")
    if isinstance(d, str) and len(d) == 10 and d[4] == "-":
        return d[8:10] + "/" + d[5:7] + "/" + d[:4]
    return str(d)

SHEET_RANGE = "Sheet1"
_HEADER = [["doc_type", "doc_number", "doc_date", "channel",
            "salesperson", "customer_name", "subtotal", "vat", "total", "payment_status", "gdrive_filename"]]
_ITEMS_HEADER = [["doc_number", "doc_type", "line_no", "description", "quantity", "unit", "unit_price", "total", "sku_code", "product_name"]]


def _get_service():
    sa_json = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    info = json.loads(sa_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
    return build("sheets", "v4", credentials=creds)


def ensure_header(sheet_id: str) -> None:
    service = _get_service()
    resp = service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range="Sheet1!A1"
    ).execute()
    if not resp.get("values"):
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id, range="Sheet1!A1",
            valueInputOption="RAW", body={"values": _HEADER}
        ).execute()


def append_document_row(sheet_id: str, row_data: dict) -> None:
    service = _get_service()
    row = [[
        row_data["doc_type"],
        row_data["doc_number"],
        _fmt_date(row_data["doc_date"]),
        row_data.get("channel", ""),
        row_data.get("salesperson", ""),
        row_data.get("customer_name", ""),
        float(row_data["subtotal"]) if row_data.get("subtotal") is not None else "",
        float(row_data["vat"]) if row_data.get("vat") is not None else "",
        float(row_data["total"]) if row_data.get("total") is not None else "",
        row_data.get("payment_status", ""),
        row_data.get("gdrive_filename", ""),
    ]]
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id, range=f"{SHEET_RANGE}!A1",
        valueInputOption="RAW", body={"values": row}
    ).execute()


def batch_append_rows(sheet_id: str, rows: List[dict]) -> None:
    if not rows:
        return
    service = _get_service()
    values = [[
        r["doc_type"], r["doc_number"], _fmt_date(r["doc_date"]),
        r.get("channel", ""), r.get("salesperson", ""),
        r.get("customer_name", ""),
        float(r["subtotal"]) if r.get("subtotal") is not None else "",
        float(r["vat"]) if r.get("vat") is not None else "",
        float(r["total"]) if r.get("total") is not None else "",
        r.get("payment_status", ""), r.get("gdrive_filename", ""),
    ] for r in rows]
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id, range=f"{SHEET_RANGE}!A1",
        valueInputOption="RAW", body={"values": values}
    ).execute()


def ensure_items_header(sheet_id: str) -> None:
    service = _get_service()
    resp = service.spreadsheets().values().get(
        spreadsheetId=sheet_id, range="Items!A1"
    ).execute()
    if not resp.get("values"):
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id, range="Items!A1",
            valueInputOption="RAW", body={"values": _ITEMS_HEADER}
        ).execute()


def batch_append_items(sheet_id: str, items: List[dict]) -> None:
    if not items:
        return
    service = _get_service()
    values = [[
        r["doc_number"], r["doc_type"], r["line_no"],
        r["description"], float(r["quantity"]), r["unit"],
        float(r["unit_price"]), float(r["total"]),
        r.get("sku_code", ""), r.get("product_name", ""),
    ] for r in items]
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id, range="Items!A1",
        valueInputOption="RAW", body={"values": values}
    ).execute()
