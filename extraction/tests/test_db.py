import os
import pytest
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ.get("DATABASE_URL", "postgresql://crm:crm1234@localhost:5432/crm_db")


@pytest.fixture
def conn():
    c = psycopg2.connect(DB_URL)
    c.autocommit = False
    yield c
    c.rollback()
    c.close()


from db import upsert_salesperson, upsert_customer, insert_document, insert_document_items, log_sync, is_already_synced
from parsers.xlsx_parser import CustomerData


def test_upsert_salesperson_returns_existing(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO salespersons (name, channel) VALUES ('TestSP', 'Web') RETURNING id")
        existing_id = cur.fetchone()[0]

    sp_id = upsert_salesperson(conn, name="TestSP", channel="Web")
    assert sp_id == existing_id


def test_upsert_salesperson_does_not_create_unknown(conn):
    sp_id = upsert_salesperson(conn, name="03-MAR", channel="Web")
    assert sp_id is None


def test_upsert_salesperson_matches_case_insensitive_trimmed_name(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO salespersons (name, channel) VALUES ('Case Trim SP', 'Web') RETURNING id")
        existing_id = cur.fetchone()[0]

    sp_id = upsert_salesperson(conn, name="  case trim sp  ", channel="Web")
    assert sp_id == existing_id


def test_upsert_customer_by_tax_id(conn):
    c = CustomerData(name="Test Co", tax_id="1234567890123", address="Bangkok")
    cid = upsert_customer(conn, c, province="Bangkok")
    assert isinstance(cid, int)
    cid2 = upsert_customer(conn, c, province="Bangkok")
    assert cid == cid2


def test_upsert_customer_by_tax_id_when_duplicate_tax_ids_exist(conn):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO customers (name, tax_id, address, province, updated_at)
            VALUES ('Duplicate Tax A', '5555555555555', '', 'BKK', NOW()),
                   ('Duplicate Tax B', '5555555555555', '', 'BKK', NOW())
            RETURNING id
        """)
        ids = [row[0] for row in cur.fetchall()]

    c = CustomerData(name="Duplicate Tax B", tax_id="5555555555555", address="Bangkok")
    cid = upsert_customer(conn, c, province="Bangkok")
    assert cid in ids


def test_upsert_customer_trims_name_and_tax_id(conn):
    c = CustomerData(name="  Trim Co  ", tax_id="  6666666666666  ", address="  Bangkok  ")
    cid = upsert_customer(conn, c, province="  BKK  ")

    with conn.cursor() as cur:
        cur.execute("SELECT name, tax_id, address, province FROM customers WHERE id = %s", (cid,))
        row = cur.fetchone()

    assert row == ("Trim Co", "6666666666666", "Bangkok", "BKK")


def test_upsert_customer_matches_existing_trimmed_name(conn):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO customers (name, tax_id, address, province, updated_at)
            VALUES ('Trim Duplicate', NULL, '', 'BKK', NOW())
            RETURNING id
        """)
        existing_id = cur.fetchone()[0]

    c = CustomerData(name="  Trim Duplicate  ", tax_id="  1111111111111  ", address="Bangkok")
    cid = upsert_customer(conn, c, province="Bangkok")
    assert cid == existing_id


def test_upsert_customer_no_tax_id(conn):
    c = CustomerData(name="คุณทดสอบNoTax", tax_id=None, address="")
    cid = upsert_customer(conn, c, province="PTPU")
    assert isinstance(cid, int)


def test_insert_document(conn):
    from datetime import date
    with conn.cursor() as cur:
        cur.execute("INSERT INTO salespersons (name, channel) VALUES ('TestSP2', 'Web') RETURNING id")
        sp_id = cur.fetchone()[0]
    cust_id = upsert_customer(conn, CustomerData("Test Co2", "9999999999999", ""), "BKK")
    doc_id = insert_document(conn, {
        "doc_type": "tax_invoice",
        "doc_number": "TEST001",
        "doc_date": date(2026, 1, 1),
        "channel": "Web",
        "salesperson_id": sp_id,
        "payment_status": "paid",
        "ref_doc_number": None,
        "customer_id": cust_id,
        "subtotal": 100.00,
        "vat": 7.00,
        "total": 107.00,
        "notes": "",
        "gdrive_file_id": "test_file_001",
        "gdrive_filename": "test.xlsx",
    })
    assert isinstance(doc_id, int)


def test_insert_tax_invoice_marks_customer_active(conn):
    from datetime import date
    with conn.cursor() as cur:
        cur.execute("INSERT INTO salespersons (name, channel) VALUES ('TestSPStatus', 'Web') RETURNING id")
        sp_id = cur.fetchone()[0]
    cust_id = upsert_customer(conn, CustomerData("Test Co Status", "7777777777777", ""), "BKK")

    doc_id = insert_document(conn, {
        "doc_type": "tax_invoice",
        "doc_number": "TESTSTATUS001",
        "doc_date": date(2026, 1, 3),
        "channel": "Web",
        "salesperson_id": sp_id,
        "payment_status": "paid",
        "ref_doc_number": None,
        "customer_id": cust_id,
        "subtotal": 100.00,
        "vat": 7.00,
        "total": 107.00,
        "notes": "",
        "gdrive_file_id": "test_file_status_001",
        "gdrive_filename": "test-status.xlsx",
    })

    with conn.cursor() as cur:
        cur.execute("SELECT status FROM customers WHERE id = %s", (cust_id,))
        status = cur.fetchone()[0]

    assert isinstance(doc_id, int)
    assert status == "active"


def test_insert_document_allows_unknown_salesperson(conn):
    from datetime import date
    cust_id = upsert_customer(conn, CustomerData("Test Co3", "8888888888888", ""), "BKK")
    doc_id = insert_document(conn, {
        "doc_type": "tax_invoice",
        "doc_number": "TEST002",
        "doc_date": date(2026, 1, 2),
        "channel": None,
        "salesperson_id": None,
        "payment_status": "paid",
        "ref_doc_number": None,
        "customer_id": cust_id,
        "subtotal": 100.00,
        "vat": 7.00,
        "total": 107.00,
        "notes": "",
        "gdrive_file_id": "test_file_002",
        "gdrive_filename": "test2.xlsx",
    })
    assert isinstance(doc_id, int)


def test_log_sync_and_check(conn):
    log_sync(conn, gdrive_file_id="f_test_sync", filename="f.xlsx", status="success", error_msg=None)
    assert is_already_synced(conn, "f_test_sync") is True
    assert is_already_synced(conn, "f_nonexistent") is False
