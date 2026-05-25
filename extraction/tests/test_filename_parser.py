import pytest
from datetime import date
from parsers.filename_parser import parse_filename, FilenameMetadata


def test_tax_invoice_basic():
    meta = parse_filename("TI_B No 256V 15-05-2026 Web Pickachu(-PAID-)(--) เคไอที PTPU.xlsx")
    assert meta.doc_type == "tax_invoice"
    assert meta.doc_number == "256V"
    assert meta.doc_date == date(2026, 5, 15)
    assert meta.channel == "Web"
    assert meta.salesperson == "Pickachu"
    assert meta.payment_status == "paid"
    assert meta.ref_doc_number is None
    assert meta.customer_short == "เคไอที"
    assert meta.province == "PTPU"


def test_tax_invoice_with_ref():
    meta = parse_filename("TI_B No 258V 18-05-2026 Web Pickachu (-PAID-)(179PW) ดีดี PTPU.xlsx")
    assert meta.doc_number == "258V"
    assert meta.ref_doc_number == "179PW"
    assert meta.customer_short == "ดีดี"


def test_tax_invoice_long_customer_name():
    meta = parse_filename(
        "TI_B No 257V 18-05-2026 Incall099 Yaowalee (-PAID-)(122YR) "
        "บริษัท อารีย์ เอ็กซิบิชั่น จำกัด Pathum Thani.xlsx"
    )
    assert meta.salesperson == "Yaowalee"
    assert meta.channel == "Incall099"
    assert meta.customer_short == "บริษัท อารีย์ เอ็กซิบิชั่น จำกัด"
    assert meta.province == "Pathum Thani"


def test_tax_invoice_underscore_paid_format():
    meta = parse_filename("I_B No 033KL 29-04-2026 KLWI Wanida_PAID_ (--) KLPU.xlsx")
    assert meta.doc_number == "033KL"
    assert meta.doc_date == date(2026, 4, 29)
    assert meta.channel == "KLWI"
    assert meta.salesperson == "Wanida"
    assert meta.payment_status == "paid"
    assert meta.ref_doc_number is None
    assert meta.customer_short == ""
    assert meta.province == "KLPU"


def test_tax_invoice_without_channel_or_salesperson_keeps_customer_name():
    meta = parse_filename(
        "TI_B No 421V  09-10-2020  ห้างหุ้นส่วนจำกัด ทูบี เรนทอล"
        "(-PAID-)(056JS) (สำนักงานใหญ่) Bangkok.xlsx"
    )
    assert meta.doc_number == "421V"
    assert meta.doc_date == date(2020, 10, 9)
    assert meta.channel is None
    assert meta.salesperson is None
    assert meta.payment_status == "paid"
    assert meta.ref_doc_number == "056JS"
    assert meta.customer_short == "ห้างหุ้นส่วนจำกัด ทูบี เรนทอล"
    assert meta.province == "Bangkok"


def test_quotation_basic():
    meta = parse_filename("Quotation No 177PR 14-05-2026 Web Pickachu (--) คุณภูริ PTPU.xlsx")
    assert meta.doc_type == "quotation"
    assert meta.doc_number == "177PR"
    assert meta.doc_date == date(2026, 5, 14)
    assert meta.payment_status == "pending"
    assert meta.ref_doc_number is None
    assert meta.customer_short == "คุณภูริ"


def test_quotation_version_suffix():
    meta = parse_filename(
        "Quotation No 174PRv2 15-05-2026 Incall099 Pickachu (--) คุณไฟฟ้า Chiang Mai.xlsx"
    )
    assert meta.doc_number == "174PRv2"
    assert meta.province == "Chiang Mai"


def test_invalid_filename_raises():
    with pytest.raises(ValueError, match="Cannot parse"):
        parse_filename("random_file.xlsx")
