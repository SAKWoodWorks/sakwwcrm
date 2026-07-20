import re
from typing import Optional

from db import fetch_all_products
from llm_client import ask_json, llm_available


def _decimal_text(value: float) -> str:
    text = f"{value:.3f}".rstrip("0").rstrip(".")
    return text or "0"


def _normalize_mm(value: str, unit: str) -> str:
    number = float(value)
    if unit in {"ซม", "cm"}:
        number *= 10
    return _decimal_text(number)


def _normalize_length(value: str, unit: str) -> str:
    number = float(value)
    if unit in {"มม", "mm"}:
        number /= 1000
    elif unit in {"ซม", "cm"}:
        number /= 100
    return _decimal_text(number)


def _inch_value(value: str) -> float:
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        return float(numerator) / float(denominator)
    return float(value)


def _nominal_inches_to_mm(value: float, *, position: int, description: str) -> Optional[str]:
    text = description.lower()
    is_battens = "battens" in text or "ไม้โครง" in description
    is_beams = "beams" in text

    if position == 1:
        thickness_map = {
            0.5: 13,
            0.75: 13 if is_beams else 15,
            1: 20,
            1.5: 30 if is_battens else 35,
            2: 40 if is_battens else 45,
        }
        mm = thickness_map.get(value)
    else:
        width_map = {
            2: 40 if is_battens and "2'' x 2''" in text else 46,
            3: 70,
            4: 96,
            6: 145,
            8: 195,
            10: 250,
            12: 300,
        }
        mm = width_map.get(value)

    return _decimal_text(mm) if mm is not None else None


def _extract_dimensions(description: str) -> Optional[tuple[str, str, str]]:
    """Return (thickness_mm, width_mm, length_m) from common invoice formats."""
    spaced = description.lower()
    unit_match = re.search(
        r'(\d+(?:\.\d+)?)\s*(มม|ซม|ม|mm|cm|m)\.?\s*[x×]\s*'
        r'(\d+(?:\.\d+)?)\s*(มม|ซม|ม|mm|cm|m)\.?\s*[x×]\s*'
        r'(\d+(?:\.\d+)?)\s*(มม|ซม|ม|mm|cm|m)\.?',
        spaced,
        re.IGNORECASE,
    )
    if unit_match:
        return (
            _normalize_mm(unit_match.group(1), unit_match.group(2)),
            _normalize_mm(unit_match.group(3), unit_match.group(4)),
            _normalize_length(unit_match.group(5), unit_match.group(6)),
        )

    compact = description.replace(" ", "")

    thai_match = re.search(
        r'(\d+(?:\.\d+)?)(มม|ซม)\.?[x×](\d+(?:\.\d+)?)(มม|ซม)\.?[x×](\d+(?:\.\d+)?)(มม|ซม|ม)\.?',
        compact,
        re.IGNORECASE,
    )
    if thai_match:
        return (
            _normalize_mm(thai_match.group(1), thai_match.group(2)),
            _normalize_mm(thai_match.group(3), thai_match.group(4)),
            _normalize_length(thai_match.group(5), thai_match.group(6)),
        )

    english_mm_match = re.search(
        r'(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)(?:mm|มม)',
        compact,
        re.IGNORECASE,
    )
    if english_mm_match:
        return (
            _decimal_text(float(english_mm_match.group(1))),
            _decimal_text(float(english_mm_match.group(2))),
            _normalize_length(english_mm_match.group(3), "mm"),
        )

    imperial_match = re.search(
        r'(\d+(?:\.\d+)?|\d+/\d+)\s*(?:"|\'\')\s*[x×]\s*'
        r'(\d+(?:\.\d+)?|\d+/\d+)\s*(?:"|\'\')\s*[x×]\s*'
        r'(\d+(?:\.\d+)?)\s*(?:เมตร|m)\.?',
        description,
        re.IGNORECASE,
    )
    if imperial_match:
        thickness = _nominal_inches_to_mm(_inch_value(imperial_match.group(1)), position=1, description=description)
        width = _nominal_inches_to_mm(_inch_value(imperial_match.group(2)), position=2, description=description)
        if thickness and width:
            return (thickness, width, _decimal_text(float(imperial_match.group(3))))

    return None


def _keyword_candidates(description: str) -> list[str]:
    text = description.lower()
    candidates: list[str] = []
    if "ไม้แปรรูปสนรัสเซีย" in description or "timber" in text:
        candidates.append("Timber")
    if "ไม้ระแนงสนรัสเซีย" in description or "ไม้โครงสนรัสเซีย" in description or "battens" in text:
        candidates.append("Battens")
    if "gu timber" in text or "เสาไม้สนประสาน" in description or "glued-up" in text:
        candidates.append("Glued-up")
    if "bamboo decking" in text:
        candidates.append("Bamboo Decking")
    if not candidates and description.split():
        candidates.append(description.split()[0])
    return candidates


def _bamboo_terms(description: str) -> Optional[list[str]]:
    text = description.lower()
    if "bamboo decking" not in text:
        return None
    if "flat" in text:
        return []

    terms = ["Bamboo Decking"]
    if "big wave" in text:
        terms.append("Big Wave")
    elif "v groove" in text or "v-groove" in text:
        terms.append("V-groove")
    else:
        return []

    if "teak" in text:
        terms.append("Teak")
    elif "coffee" in text:
        terms.append("Coffee")
    else:
        return []

    return terms


def _description_candidates(description: str) -> list[str]:
    normalized = " ".join(description.split())
    candidates = [description]
    if normalized != description:
        candidates.append(normalized)
    for pattern in [
        r"\s+แพ็ค\b.*$",
        r"\s+CUT\b.*$",
        r"\s+ตัด.*$",
        r"\s+//.*$",
        r"\s+=.*$",
        r"\s+\(=.*$",
    ]:
        stripped = re.sub(pattern, "", normalized, flags=re.IGNORECASE).strip()
        if stripped and stripped not in candidates:
            candidates.append(stripped)
    return candidates


_LLM_MATCH_SYSTEM_PROMPT = """You match line-item descriptions from Thai timber/wood product \
invoices to a product catalog for a CRM system.

You will be given one line-item description and a catalog of products, each listed as \
"id\tsku_code\tfull_name". Identify the single catalog product the description refers to, \
if any. Descriptions may mix Thai and English, include dimensions (thickness x width x \
length, in various units), packing notes, or other free text.

Respond with JSON only, no other text, no markdown fences:
{"product_id": <int or null>, "confidence": "high" or "low"}

Only use "high" confidence when you are confident the product_id is an exact, unambiguous \
match. If uncertain, no clear match exists, or more than one product could plausibly match, \
respond with "confidence": "low" (product_id may still be your best guess, but it will be \
ignored unless confidence is "high")."""

# In-process memo so repeated descriptions in one run don't re-hit the API.
_llm_match_cache: dict[str, Optional[int]] = {}


def _insert_transform_rule(conn, description: str, product_id: int) -> None:
    """Persist an LLM tier-4 match as a deterministic tier-3 rule for future runs."""
    pattern = f"^{re.escape(description)}$"
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO product_transform_rules (pattern, product_id) VALUES (%s, %s)",
            (pattern, product_id),
        )


def _llm_match_product_id(conn, description: str) -> Optional[int]:
    """Strategy 4: ask Claude to match against the full product catalog.

    Only called when strategies 1-3 miss. Returns None (never raises) if the
    API key is missing, the API call fails, or the response isn't a confident,
    valid match.
    """
    if not llm_available():
        return None
    if description in _llm_match_cache:
        return _llm_match_cache[description]

    products = fetch_all_products(conn)
    if not products:
        _llm_match_cache[description] = None
        return None

    catalog_text = "\n".join(f"{p['id']}\t{p['sku_code']}\t{p['full_name']}" for p in products)
    user_prompt = f"Description:\n{description}\n\nCatalog (id\\tsku_code\\tfull_name):\n{catalog_text}"

    result = ask_json(_LLM_MATCH_SYSTEM_PROMPT, user_prompt)

    matched_id: Optional[int] = None
    if result:
        candidate = result.get("product_id")
        confidence = result.get("confidence")
        valid_ids = {p["id"] for p in products}
        if confidence == "high" and isinstance(candidate, int) and not isinstance(candidate, bool) and candidate in valid_ids:
            matched_id = candidate
            _insert_transform_rule(conn, description, matched_id)

    _llm_match_cache[description] = matched_id
    return matched_id


def match_product_id(conn, description: str) -> Optional[int]:
    """Match description to product_id.

    Strategy 1: full_name prefix match
    Strategy 2: dimension + product keyword, with stricter Bamboo profile/color matching
    Strategy 3: product_transform_rules regex (manual overrides)
    Strategy 4: LLM-assisted match against the full catalog (only when 1-3 miss
      and an Anthropic API key is configured); accepted matches are persisted
      as a new tier-3 rule so future runs don't need the API.
    """
    product_id = _match_product_id_by_rules(conn, description)
    if product_id is not None:
        return product_id
    return _llm_match_product_id(conn, description)


def _match_product_id_by_rules(conn, description: str) -> Optional[int]:
    with conn.cursor() as cur:
        # Strategy 1: full_name prefix
        for candidate in _description_candidates(description):
            cur.execute("""
                SELECT id FROM products
                WHERE %s ILIKE full_name || '%%'
                LIMIT 1
            """, (candidate,))
            row = cur.fetchone()
            if row:
                return row[0]

        # Strategy 2: dimension + product keyword
        dimensions = _extract_dimensions(description)
        if dimensions:
            t, w, l = dimensions
            bamboo_terms = _bamboo_terms(description)
            if bamboo_terms:
                term_filters = " AND ".join(["full_name ILIKE %s"] * len(bamboo_terms))
                cur.execute(f"""
                    SELECT id FROM products
                    WHERE thickness = %s AND width = %s AND length = %s
                      AND {term_filters}
                    ORDER BY id
                    LIMIT 2
                """, (t, w, l, *[f"%{term}%" for term in bamboo_terms]))
                rows = cur.fetchall()
                if len(rows) == 1:
                    return rows[0][0]
            elif bamboo_terms is None:
                for keyword in _keyword_candidates(description):
                    cur.execute("""
                        SELECT id FROM products
                        WHERE thickness = %s AND width = %s AND length = %s
                          AND full_name ILIKE %s || '%%'
                        LIMIT 1
                    """, (t, w, l, keyword))
                    row = cur.fetchone()
                    if row:
                        return row[0]

                for keyword in _keyword_candidates(description):
                    cur.execute("""
                        SELECT id FROM products
                        WHERE ABS(thickness - %s::numeric) <= 1
                          AND ABS(width - %s::numeric) <= 1
                          AND length = %s
                          AND full_name ILIKE %s || '%%'
                        ORDER BY id
                        LIMIT 2
                    """, (t, w, l, keyword))
                    rows = cur.fetchall()
                    if len(rows) == 1:
                        return rows[0][0]

            if bamboo_terms is None:
                cur.execute("""
                    SELECT id FROM products
                    WHERE thickness = %s AND width = %s AND length = %s
                    ORDER BY id
                    LIMIT 2
                """, (t, w, l))
                rows = cur.fetchall()
                if len(rows) == 1:
                    return rows[0][0]

                cur.execute("""
                    SELECT id FROM products
                    WHERE ABS(thickness - %s::numeric) <= 1
                      AND ABS(width - %s::numeric) <= 1
                      AND length = %s
                    ORDER BY id
                    LIMIT 2
                """, (t, w, l))
                rows = cur.fetchall()
                if len(rows) == 1:
                    return rows[0][0]

            if bamboo_terms is not None:
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
