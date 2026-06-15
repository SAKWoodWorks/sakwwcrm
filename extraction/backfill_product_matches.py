"""
Backfill document_items.product_id for rows imported before matcher improvements.

Default is dry-run. Use --apply to update DB.
"""
import argparse
import io
import os
import re
import sys
from collections import Counter
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from psycopg2.extras import execute_values

from product_matcher import (
    _bamboo_terms,
    _decimal_text,
    _description_candidates,
    _extract_dimensions,
    _keyword_candidates,
)


def _db_decimal_text(value) -> str:
    if value is None:
        return ""
    return _decimal_text(float(value))


def fetch_match_data(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, full_name, thickness, width, length
            FROM products
            ORDER BY id
        """)
        products = [
            {
                "id": row[0],
                "full_name": row[1] or "",
                "full_name_lower": (row[1] or "").lower(),
                "thickness": _db_decimal_text(row[2]),
                "width": _db_decimal_text(row[3]),
                "length": _db_decimal_text(row[4]),
            }
            for row in cur.fetchall()
        ]

        cur.execute("""
            SELECT pattern, product_id
            FROM product_transform_rules
            ORDER BY priority DESC
        """)
        rules = cur.fetchall()

    return products, rules


def match_product_from_cache(description: str, products, rules) -> int | None:
    description_lower = description.lower()

    for candidate in _description_candidates(description):
        candidate_lower = candidate.lower()
        for product in products:
            if candidate_lower.startswith(product["full_name_lower"]):
                return product["id"]

    dimensions = _extract_dimensions(description)
    if dimensions:
        t, w, l = dimensions
        dimension_matches = [
            product
            for product in products
            if product["thickness"] == t and product["width"] == w and product["length"] == l
        ]
        tolerant_dimension_matches = [
            product
            for product in products
            if product["length"] == l
            and product["thickness"]
            and product["width"]
            and abs(float(product["thickness"]) - float(t)) <= 1
            and abs(float(product["width"]) - float(w)) <= 1
        ]

        bamboo_terms = _bamboo_terms(description)
        if bamboo_terms:
            rows = [
                product
                for product in dimension_matches
                if all(term.lower() in product["full_name_lower"] for term in bamboo_terms)
            ]
            if len(rows) == 1:
                return rows[0]["id"]
        elif bamboo_terms is None:
            for keyword in _keyword_candidates(description):
                keyword_lower = keyword.lower()
                row = next(
                    (
                        product
                        for product in dimension_matches
                        if product["full_name_lower"].startswith(keyword_lower)
                    ),
                    None,
                )
                if row:
                    return row["id"]

                rows = [
                    product
                    for product in tolerant_dimension_matches
                    if product["full_name_lower"].startswith(keyword_lower)
                ]
                if len(rows) == 1:
                    return rows[0]["id"]

            if len(dimension_matches) == 1:
                return dimension_matches[0]["id"]
            if len(tolerant_dimension_matches) == 1:
                return tolerant_dimension_matches[0]["id"]

        if bamboo_terms is not None:
            for pattern, product_id in rules:
                try:
                    if re.search(pattern, description, re.UNICODE | re.IGNORECASE):
                        return product_id
                except re.error:
                    continue
            return None

    for pattern, product_id in rules:
        try:
            if re.search(pattern, description, re.UNICODE | re.IGNORECASE):
                return product_id
        except re.error:
            continue

    return None


def fetch_unmatched_items(conn, limit: int, after_id: int):
    sql = """
        SELECT id, description
        FROM document_items
        WHERE product_id IS NULL
          AND id > %s
          AND description IS NOT NULL
          AND btrim(description) <> ''
        ORDER BY id
        LIMIT %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (after_id, limit))
        return cur.fetchall()


def update_matches(conn, matched: list[tuple[int, int, str]]) -> int:
    if not matched:
        return 0

    values = [(item_id, product_id) for item_id, product_id, _description in matched]
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            UPDATE document_items AS di
            SET product_id = v.product_id
            FROM (VALUES %s) AS v(id, product_id)
            WHERE di.id = v.id
              AND di.product_id IS NULL
            """,
            values,
            template="(%s::int, %s::int)",
        )
        return cur.rowcount


def backfill(apply: bool, limit: int | None, batch_size: int):
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False

    matched: list[tuple[int, int, str]] = []
    unmatched: list[tuple[int, str]] = []
    product_counts: Counter[int] = Counter()
    processed = 0
    updated = 0
    after_id = 0
    try:
        products, rules = fetch_match_data(conn)
        print(f"loaded: products={len(products)} rules={len(rules)}", flush=True)

        while True:
            remaining = None if limit is None else limit - processed
            if remaining is not None and remaining <= 0:
                break

            take = batch_size if remaining is None else min(batch_size, remaining)
            rows = fetch_unmatched_items(conn, take, after_id)
            if not rows:
                break

            batch_matched: list[tuple[int, int, str]] = []
            for item_id, description in rows:
                product_id = match_product_from_cache(description, products, rules)
                if product_id:
                    batch_matched.append((item_id, product_id, description))
                    matched.append((item_id, product_id, description))
                    product_counts[product_id] += 1
                else:
                    unmatched.append((item_id, description))
                after_id = item_id
                processed += 1

            if apply:
                updated += update_matches(conn, batch_matched)
                conn.commit()
            else:
                conn.rollback()

            print(
                f"progress: processed={processed} matched={len(matched)} "
                f"unmatched={len(unmatched)} updated={updated} last_id={after_id}",
                flush=True,
            )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return matched, unmatched, product_counts, updated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Update document_items.product_id")
    parser.add_argument("--limit", type=int, default=None, help="Limit rows for testing")
    parser.add_argument("--batch-size", type=int, default=50, help="Rows to scan per DB batch")
    parser.add_argument("--sample", type=int, default=20, help="Print sample rows")
    args = parser.parse_args()

    if args.batch_size <= 0:
        raise SystemExit("--batch-size must be greater than 0")

    matched, unmatched, product_counts, updated = backfill(args.apply, args.limit, args.batch_size)
    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"{mode}: matched={len(matched)} unmatched={len(unmatched)} updated={updated}")

    if product_counts:
        print("\nTop product_id matches:")
        for product_id, count in product_counts.most_common(20):
            print(f"  product_id={product_id}: {count}")

    print("\nMatched sample:")
    for item_id, product_id, description in matched[: args.sample]:
        print(f"  item_id={item_id} -> product_id={product_id}: {description[:120]}")

    print("\nUnmatched sample:")
    for item_id, description in unmatched[: args.sample]:
        print(f"  item_id={item_id}: {description[:120]}")


if __name__ == "__main__":
    main()
