from unittest.mock import MagicMock
from product_matcher import match_product_id


def make_mock_conn(rules, strategy1=None, strategy2_rows=None, strategy2_fetches=None, strategy2_fetchall_sequence=None):
    """
    rules: [(pattern, product_id)] for transform_rules (strategy 3)
    strategy1: tuple (id,) or None for full_name prefix
    strategy2_fetches: fetchone sequence for dimension + keyword attempts
    strategy2_rows: fetchall rows for safe dimension-only match
    """
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = lambda s: cursor
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.side_effect = [strategy1, *(strategy2_fetches or [])]
    sorted_rules = sorted(rules, key=lambda x: x[2], reverse=True) if rules and len(rules[0]) == 3 else rules
    rules_rows = [(r[0], r[1]) for r in sorted_rules] if sorted_rules and len(sorted_rules[0]) == 3 else sorted_rules
    fetchall_rows = []
    if strategy2_fetchall_sequence is not None:
        fetchall_rows.extend(strategy2_fetchall_sequence)
    elif strategy2_rows is not None:
        fetchall_rows.append(strategy2_rows)
    fetchall_rows.append(rules_rows)
    cursor.fetchall.side_effect = fetchall_rows
    conn.cursor.return_value = cursor
    return conn


def test_strategy1_fullname_prefix():
    """Strategy 1 hit — returns immediately without checking rules."""
    conn = make_mock_conn(rules=[], strategy1=(42,))
    result = match_product_id(conn, "Timber S4S ไม้สน 1'' x 4'' x 6 เมตร (20มม.x96มม.x6ม.)")
    assert result == 42


def test_strategy1_matches_when_packing_note_follows_product_name():
    conn = make_mock_conn(rules=[], strategy1=None)
    cursor = conn.cursor.return_value
    cursor.fetchone.side_effect = [None, None, (10,)]

    result = match_product_id(
        conn,
        "Timber S4S ไม้สน 1'' x 4'' x 3 เมตร (20มม.x96มม.x3ม.)\nแพ็ค 3 แผ่น/มัด (= 15 มัด + 1 แผ่น)",
    )

    assert result == 10


def test_strategy2_dimension_keyword():
    """Strategy 2a: dimension + keyword match."""
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(7,)])
    result = match_product_id(conn, "Beams ไม้สน 0.5'' x 4'' x 3 เมตร (13มม.x96มม.x3ม.)")
    assert result == 7


def test_strategy2_imperial_dimensions():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(1,)])
    result = match_product_id(conn, "Timber (ไม้สน) 1'' x 4'' x 6m.")
    assert result == 1


def test_strategy2_tolerates_one_mm_catalog_difference():
    conn = make_mock_conn(
        rules=[],
        strategy1=None,
        strategy2_fetches=[None],
        strategy2_fetchall_sequence=[[(20,)], []],
    )
    result = match_product_id(conn, "Battens ไม้สน 1'' x 2'' x 3 เมตร (20มม.x45มม.x3ม.)")
    assert result == 20


def test_strategy2_supports_multiplication_sign_dimension_separator():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(23,)])
    result = match_product_id(conn, "Battens ไม้โครงสน 1.5'' × 3'' × 3 เมตร (30มม.×70มม.×3ม.)")
    assert result == 23


def test_strategy2_beams_three_quarter_inch_uses_catalog_thickness():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(27,)])
    result = match_product_id(conn, "Beams (ไม้สน) 3/4'' x 6'' x 6m.")
    assert result == 27


def test_strategy2_centimeter_dimensions():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(11,)])
    result = match_product_id(conn, "ไม้แปรรูปสนรัสเซีย 1'' x 6'' x 3 เมตร (2ซม.x14.5ซม.x3ม.)")
    assert result == 11


def test_strategy2_english_mm_dimensions():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_rows=[(75,)])
    result = match_product_id(conn, "Bamboo Decking 18 x 137 x 2440 mm. / V GROOVE / Teak color")
    assert result == 75


def test_bamboo_flat_does_not_fallback_to_dimension_only():
    conn = make_mock_conn(rules=[], strategy1=None)
    result = match_product_id(conn, "Bamboo Decking / FLAT Size 18 x 137 x 2440 mm. / Teak")
    assert result is None


def test_strategy2_english_unit_per_dimension():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[(42,)])
    result = match_product_id(conn, 'GU Timber เสาไม้สนประสาน 4" x 4" x 3 m. (90 mm. x 90 mm. x 3000 mm.)')
    assert result == 42


def test_dimension_only_requires_unique_product():
    conn = make_mock_conn(
        rules=[],
        strategy1=None,
        strategy2_fetches=[None],
        strategy2_fetchall_sequence=[[], [(1,), (2,)], [(1,), (2,)]],
    )
    result = match_product_id(conn, "unknown product (20มม.x96มม.x3ม.)")
    assert result is None


def test_strategy3_transform_rules():
    """Strategy 3: regex rules when products table returns nothing."""
    conn = make_mock_conn(
        rules=[(r"ไม้สน.*1.*x.*6", 42, 10), (r"ไม้ยาง", 99, 5)],
        strategy1=None, strategy2_fetches=[],
    )
    result = match_product_id(conn, "ไม้สน custom 1x6")
    assert result == 42


def test_higher_priority_wins():
    """Transform rules ordered by priority DESC — first match wins."""
    conn = make_mock_conn(
        rules=[(r"ไม้สน.*6", 2, 10), (r"ไม้สน", 1, 5)],
        strategy1=None, strategy2_fetches=[],
    )
    result = match_product_id(conn, "ไม้สน 1x6")
    assert result == 2


def test_no_match_returns_none():
    conn = make_mock_conn(rules=[(r"ไม้ยาง", 99, 5)], strategy1=None, strategy2_fetches=[])
    result = match_product_id(conn, "something completely different")
    assert result is None


def test_empty_rules_returns_none():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2_fetches=[])
    result = match_product_id(conn, "ไม้สน")
    assert result is None
