import psycopg2
from typing import Optional
from parsers.xlsx_parser import CustomerData


def upsert_salesperson(conn, name: str, channel: str) -> Optional[int]:
    name = (name or "").strip()
    if not name:
        return None

    with conn.cursor() as cur:
        cur.execute("""
            SELECT id
            FROM salespersons
            WHERE lower(btrim(name)) = lower(%s)
            ORDER BY active DESC, id ASC
            LIMIT 1
        """, (name,))
        row = cur.fetchone()
        if row:
            return row[0]
        return None


def upsert_customer(conn, customer: CustomerData, province: str) -> int:
    name = (customer.name or "").strip()
    tax_id = (customer.tax_id or "").strip() or None
    address = (customer.address or "").strip()
    province = (province or "").strip() or None

    with conn.cursor() as cur:
        if tax_id:
            cur.execute("""
                SELECT id
                FROM customers
                WHERE tax_id = %s AND btrim(name) = %s
                ORDER BY id ASC
                LIMIT 1
            """, (tax_id, name))
            row = cur.fetchone()
            if not row:
                cur.execute("""
                    SELECT id
                    FROM customers
                    WHERE btrim(name) = %s
                    ORDER BY updated_at DESC NULLS LAST, id ASC
                    LIMIT 1
                """, (name,))
                row = cur.fetchone()
            if not row:
                cur.execute("""
                    SELECT id
                    FROM customers
                    WHERE tax_id = %s
                    ORDER BY updated_at DESC NULLS LAST, id ASC
                    LIMIT 1
                """, (tax_id,))
                row = cur.fetchone()
            if row:
                cur.execute("""
                    UPDATE customers
                    SET name = btrim(name),
                        tax_id = COALESCE(tax_id, %s),
                        address = %s,
                        province = COALESCE(%s, province),
                        updated_at = NOW()
                    WHERE id = %s
                """, (tax_id, address, province, row[0]))
                return row[0]
            cur.execute("""
                INSERT INTO customers (name, tax_id, address, province, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING id
            """, (name, tax_id, address, province))
            return cur.fetchone()[0]
        else:
            cur.execute("""
                SELECT c.id
                FROM customers c
                WHERE btrim(c.name) = %s
                UNION
                SELECT ca.customer_id
                FROM customer_aliases ca
                WHERE btrim(ca.alias_name) = %s
                LIMIT 1
            """, (name, name))
            row = cur.fetchone()
            if row:
                return row[0]
            cur.execute("""
                INSERT INTO customers (name, address, province, updated_at)
                VALUES (%s, %s, %s, NOW())
                RETURNING id
            """, (name, address, province))
            return cur.fetchone()[0]


def insert_document(conn, d: dict) -> int:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO documents (
                doc_type, doc_number, doc_date, channel, salesperson_id,
                payment_status, ref_doc_number, customer_id,
                subtotal, vat, total, notes, gdrive_file_id, gdrive_filename
            ) VALUES (
                %(doc_type)s, %(doc_number)s, %(doc_date)s, %(channel)s, %(salesperson_id)s,
                %(payment_status)s, %(ref_doc_number)s, %(customer_id)s,
                %(subtotal)s, %(vat)s, %(total)s, %(notes)s, %(gdrive_file_id)s, %(gdrive_filename)s
            )
            ON CONFLICT (gdrive_file_id) DO NOTHING
            RETURNING id
        """, d)
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT id FROM documents WHERE gdrive_file_id = %s", (d["gdrive_file_id"],))
            row = cur.fetchone()
        if d.get("doc_type") == "tax_invoice" and d.get("customer_id") is not None:
            cur.execute("""
                UPDATE customers
                SET status = 'active', updated_at = NOW()
                WHERE id = %s
                  AND status = 'not_purchase_yet'
            """, (d["customer_id"],))
        return row[0]


def insert_document_items(conn, document_id: int, items: list, product_ids: list) -> None:
    with conn.cursor() as cur:
        for item, product_id in zip(items, product_ids):
            cur.execute("""
                INSERT INTO document_items (
                    document_id, line_no, description, quantity, unit, unit_price, total, product_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                document_id, item.line_no, item.description,
                item.quantity, item.unit, item.unit_price, item.total, product_id,
            ))


def fetch_all_products(conn) -> list:
    """Returns [{"id": int, "sku_code": str, "full_name": str}, ...] for every product.

    Used to build the compact catalog sent to the LLM tier-4 product matcher.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT id, sku_code, full_name FROM products ORDER BY id")
        return [
            {"id": row[0], "sku_code": row[1] or "", "full_name": row[2] or ""}
            for row in cur.fetchall()
        ]


def fetch_products_by_ids(conn, ids: list) -> dict:
    """Returns {product_id: {"sku_code": str, "full_name": str}}"""
    valid_ids = [i for i in ids if i is not None]
    if not valid_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, sku_code, full_name FROM products WHERE id = ANY(%s)",
            (valid_ids,)
        )
        return {row[0]: {"sku_code": row[1] or "", "full_name": row[2] or ""} for row in cur.fetchall()}


def log_sync(conn, gdrive_file_id: str, filename: str, status: str, error_msg: Optional[str]) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO sync_log (gdrive_file_id, filename, status, error_msg)
            VALUES (%s, %s, %s, %s)
        """, (gdrive_file_id, filename, status, error_msg))
    conn.commit()


def is_already_synced(conn, gdrive_file_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 1 FROM sync_log
            WHERE gdrive_file_id = %s AND status = 'success'
            LIMIT 1
        """, (gdrive_file_id,))
        return cur.fetchone() is not None
