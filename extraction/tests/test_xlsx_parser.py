import pytest
from decimal import Decimal
from pathlib import Path
from parsers.xlsx_parser import parse_tax_invoice, parse_quotation, DocumentData

# extraction/ is parent.parent, new-crm/ is parent.parent.parent
SAMPLE_DIR = Path(__file__).parent.parent.parent
TI_SAMPLE = SAMPLE_DIR / "TAX-Invoices" / "TI_B No 256V 15-05-2026 Web Pickachu(-PAID-)(--) เคไอที PTPU.xlsx"
QT_SAMPLE = SAMPLE_DIR / "Quoatation" / "Quotation No 177PR 14-05-2026 Web Pickachu (--) คุณภูริ PTPU.xlsx"


@pytest.mark.skipif(not TI_SAMPLE.exists(), reason="sample file not present")
def test_parse_tax_invoice_customer():
    doc = parse_tax_invoice(str(TI_SAMPLE))
    assert doc.customer.name != ""
    assert doc.customer.address != ""


@pytest.mark.skipif(not TI_SAMPLE.exists(), reason="sample file not present")
def test_parse_tax_invoice_doc_number():
    doc = parse_tax_invoice(str(TI_SAMPLE))
    assert doc.doc_number == "256V"


@pytest.mark.skipif(not TI_SAMPLE.exists(), reason="sample file not present")
def test_parse_tax_invoice_items():
    doc = parse_tax_invoice(str(TI_SAMPLE))
    assert len(doc.items) >= 1
    first = doc.items[0]
    assert first.description != ""
    assert first.quantity > 0
    assert first.unit_price > 0


@pytest.mark.skipif(not TI_SAMPLE.exists(), reason="sample file not present")
def test_parse_tax_invoice_totals():
    doc = parse_tax_invoice(str(TI_SAMPLE))
    assert doc.total > 0
    assert doc.vat > 0
    assert doc.subtotal > 0
    assert abs((doc.subtotal + doc.vat) - doc.total) < Decimal("1.00")


@pytest.mark.skipif(not QT_SAMPLE.exists(), reason="sample file not present")
def test_parse_quotation_doc_number():
    doc = parse_quotation(str(QT_SAMPLE))
    assert doc.doc_number == "177PR"


@pytest.mark.skipif(not QT_SAMPLE.exists(), reason="sample file not present")
def test_parse_quotation_has_items():
    doc = parse_quotation(str(QT_SAMPLE))
    assert len(doc.items) >= 1
