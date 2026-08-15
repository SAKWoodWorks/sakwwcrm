from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import extract_file


def _item():
    return SimpleNamespace(
        line_no=1,
        description="Teak board",
        quantity=Decimal("2"),
        unit="pcs",
        unit_price=Decimal("10"),
        total=Decimal("20"),
    )


def test_sheets_sync_is_skipped_when_sheet_id_is_missing(monkeypatch, capsys):
    calls = []
    monkeypatch.delenv("GOOGLE_SHEETS_ID", raising=False)
    monkeypatch.setattr(extract_file, "ensure_items_header", lambda *args: calls.append("header"))
    monkeypatch.setattr(extract_file, "append_document_row", lambda *args: calls.append("document"))
    monkeypatch.setattr(extract_file, "batch_append_items", lambda *args: calls.append("items"))

    extract_file.sync_sheets_if_configured(
        {
            "doc_type": "tax_invoice",
            "doc_number": "TI001",
            "doc_date": date(2026, 1, 1),
            "channel": "Web",
            "salesperson": "Pickachu",
            "customer_name": "Customer",
            "subtotal": 20,
            "vat": 1.4,
            "total": 21.4,
            "payment_status": "paid",
            "gdrive_filename": "test.xlsx",
        },
        [_item()],
        ["product-1"],
        {"product-1": {"sku_code": "SKU1", "full_name": "Teak Board"}},
    )

    assert calls == []
    assert "GOOGLE_SHEETS_ID not set" in capsys.readouterr().out


def test_sheets_sync_runs_when_sheet_id_is_configured(monkeypatch):
    calls = []
    monkeypatch.setenv("GOOGLE_SHEETS_ID", "sheet-123")
    monkeypatch.setattr(extract_file, "ensure_items_header", lambda sheet_id: calls.append(("header", sheet_id)))
    monkeypatch.setattr(extract_file, "append_document_row", lambda sheet_id, row: calls.append(("document", sheet_id, row["doc_number"])))
    monkeypatch.setattr(extract_file, "batch_append_items", lambda sheet_id, items: calls.append(("items", sheet_id, items[0]["sku_code"])))

    extract_file.sync_sheets_if_configured(
        {
            "doc_type": "tax_invoice",
            "doc_number": "TI001",
            "doc_date": date(2026, 1, 1),
            "channel": "Web",
            "salesperson": "Pickachu",
            "customer_name": "Customer",
            "subtotal": 20,
            "vat": 1.4,
            "total": 21.4,
            "payment_status": "paid",
            "gdrive_filename": "test.xlsx",
        },
        [_item()],
        ["product-1"],
        {"product-1": {"sku_code": "SKU1", "full_name": "Teak Board"}},
    )

    assert calls == [
        ("header", "sheet-123"),
        ("document", "sheet-123", "TI001"),
        ("items", "sheet-123", "SKU1"),
    ]
