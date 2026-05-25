"""Backfill customers.province from customers.address.

Use after changing province source from filename suffix to parsed address.
"""
import os
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))

from parsers.province_parser import extract_province_from_address


def main() -> None:
    load_dotenv()
    db_url = os.environ["DATABASE_URL"]
    dry_run = "--dry-run" in sys.argv

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, address, province FROM customers ORDER BY id")
            rows = cur.fetchall()

            updates = []
            resolved = cleared = changed = 0
            for customer_id, address, old_province in rows:
                new_province = extract_province_from_address(address)
                if new_province:
                    resolved += 1
                else:
                    cleared += 1
                if (old_province or None) != new_province:
                    changed += 1
                    updates.append((new_province, customer_id))

            print({
                "total": len(rows),
                "changed": changed,
                "resolved_from_address": resolved,
                "cleared_to_null": cleared,
                "dry_run": dry_run,
            })

            if not dry_run and updates:
                cur.executemany(
                    "UPDATE customers SET province = %s, updated_at = NOW() WHERE id = %s",
                    updates,
                )

        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
