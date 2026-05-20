"""
Import products from docs/Stock.xlsx DASHBOARD sheet into PostgreSQL.
Usage: python import_products.py [--dry-run]
"""
import argparse
import io
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import os
import openpyxl
import psycopg2

STOCK_FILE = Path(__file__).parent.parent / "docs" / "Stock.xlsx"
DATA_START_ROW = 22  # first product row in DASHBOARD


def _dec(v) -> Decimal | None:
    if v is None:
        return None
    try:
        return Decimal(str(v))
    except InvalidOperation:
        return None


def read_products():
    wb = openpyxl.load_workbook(str(STOCK_FILE), data_only=True)
    ws = wb["DASHBOARD"]
    products = []
    for r in range(DATA_START_ROW, ws.max_row + 1):
        sku_code = ws.cell(r, 1).value
        if not sku_code or not isinstance(sku_code, str):
            continue
        full_name = ws.cell(r, 35).value or sku_code
        volume = _dec(ws.cell(r, 33).value)   # CBM/pcs
        weight = _dec(ws.cell(r, 34).value)   # KG/pcs
        rt_cost = _dec(ws.cell(r, 27).value)  # Grade A Retail
        ws_cost = _dec(ws.cell(r, 28).value)  # Grade A Wholesale
        products.append({
            "sku_code": sku_code.strip(),
            "full_name": str(full_name).strip(),
            "volume": volume,
            "weight": weight,
            "rt_cost": rt_cost,
            "ws_cost": ws_cost,
        })
    return products


def upsert_products(products, dry_run=False):
    db_url = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    inserted = updated = skipped = 0
    try:
        with conn.cursor() as cur:
            for p in products:
                if dry_run:
                    print(f"  [{p['sku_code']}] {p['full_name'][:50]}  ws={p['ws_cost']}  rt={p['rt_cost']}")
                    continue

                cur.execute("""
                    INSERT INTO products (sku_code, full_name, volume, weight, ws_cost, rt_cost, updated_at)
                    VALUES (%(sku_code)s, %(full_name)s, %(volume)s, %(weight)s, %(ws_cost)s, %(rt_cost)s, NOW())
                    ON CONFLICT (sku_code) DO UPDATE SET
                        full_name  = EXCLUDED.full_name,
                        volume     = EXCLUDED.volume,
                        weight     = EXCLUDED.weight,
                        ws_cost    = EXCLUDED.ws_cost,
                        rt_cost    = EXCLUDED.rt_cost,
                        updated_at = NOW()
                    RETURNING (xmax = 0) AS inserted
                """, p)
                row = cur.fetchone()
                if row and row[0]:
                    inserted += 1
                else:
                    updated += 1

        if not dry_run:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return inserted, updated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Reading {STOCK_FILE.name} DASHBOARD sheet...")
    products = read_products()
    print(f"Found {len(products)} products")

    if args.dry_run:
        print("\n--- Dry run ---")
        for p in products:
            print(f"  [{p['sku_code']}] {p['full_name'][:60]}  vol={p['volume']}  wt={p['weight']}  ws={p['ws_cost']}  rt={p['rt_cost']}")
        return

    inserted, updated = upsert_products(products)
    print(f"Done: {inserted} inserted, {updated} updated")


if __name__ == "__main__":
    main()
