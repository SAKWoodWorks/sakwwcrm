import re
from typing import Optional


def match_product_id(conn, description: str) -> Optional[int]:
    """Match description to product_id.

    Strategy 1: full_name prefix match
    Strategy 2: dimension (Xมม.xYมม.xZม.) + first-word keyword
    Strategy 3: product_transform_rules regex (manual overrides)
    """
    with conn.cursor() as cur:
        # Strategy 1: full_name prefix
        cur.execute("""
            SELECT id FROM products
            WHERE %s ILIKE full_name || '%%'
            LIMIT 1
        """, (description,))
        row = cur.fetchone()
        if row:
            return row[0]

        # Strategy 2: dimension + keyword
        dim_match = re.search(
            r'\((\d+(?:\.\d+)?)มม\.x(\d+(?:\.\d+)?)มม\.x(\d+(?:\.\d+)?)ม\.\)',
            description,
        )
        if dim_match:
            t, w, l = dim_match.group(1), dim_match.group(2), dim_match.group(3)
            keyword = description.split()[0] if description.split() else ''
            cur.execute("""
                SELECT id FROM products
                WHERE thickness = %s AND width = %s AND length = %s
                  AND full_name ILIKE %s || '%%'
                LIMIT 1
            """, (t, w, l, keyword))
            row = cur.fetchone()
            if row:
                return row[0]
            # dimension only (no keyword match)
            cur.execute("""
                SELECT id FROM products
                WHERE thickness = %s AND width = %s AND length = %s
                LIMIT 1
            """, (t, w, l))
            row = cur.fetchone()
            if row:
                return row[0]

        # Strategy 3: transform rules regex
        cur.execute("""
            SELECT pattern, product_id FROM product_transform_rules
            ORDER BY priority DESC
        """)
        for pattern, product_id in cur.fetchall():
            try:
                if re.search(pattern, description, re.UNICODE | re.IGNORECASE):
                    return product_id
            except re.error:
                continue

    return None
