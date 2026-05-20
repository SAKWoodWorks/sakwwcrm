from unittest.mock import MagicMock
from product_matcher import match_product_id


def make_mock_conn(rules, strategy1=None, strategy2a=None, strategy2b=None):
    """
    rules: [(pattern, product_id)] for transform_rules (strategy 3)
    strategy1/2a/2b: tuple (id,) or None — return values for successive fetchone() calls
    """
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = lambda s: cursor
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.side_effect = [strategy1, strategy2a, strategy2b]
    sorted_rules = sorted(rules, key=lambda x: x[2], reverse=True) if rules and len(rules[0]) == 3 else rules
    cursor.fetchall.return_value = [(r[0], r[1]) for r in sorted_rules] if sorted_rules and len(sorted_rules[0]) == 3 else sorted_rules
    conn.cursor.return_value = cursor
    return conn


def test_strategy1_fullname_prefix():
    """Strategy 1 hit — returns immediately without checking rules."""
    conn = make_mock_conn(rules=[], strategy1=(42,))
    result = match_product_id(conn, "Timber S4S ไม้สน 1'' x 4'' x 6 เมตร (20มม.x96มม.x6ม.)")
    assert result == 42


def test_strategy2_dimension_keyword():
    """Strategy 2a: dimension + keyword match."""
    conn = make_mock_conn(rules=[], strategy1=None, strategy2a=(7,))
    result = match_product_id(conn, "Beams ไม้สน 0.5'' x 4'' x 3 เมตร (13มม.x96มม.x3ม.)")
    assert result == 7


def test_strategy3_transform_rules():
    """Strategy 3: regex rules when products table returns nothing."""
    conn = make_mock_conn(
        rules=[(r"ไม้สน.*1.*x.*6", 42, 10), (r"ไม้ยาง", 99, 5)],
        strategy1=None, strategy2a=None, strategy2b=None,
    )
    result = match_product_id(conn, "Timber S4S ไม้สน 1'' x 6'' x 3 เมตร")
    assert result == 42


def test_higher_priority_wins():
    """Transform rules ordered by priority DESC — first match wins."""
    conn = make_mock_conn(
        rules=[(r"ไม้สน.*6", 2, 10), (r"ไม้สน", 1, 5)],
        strategy1=None, strategy2a=None, strategy2b=None,
    )
    result = match_product_id(conn, "ไม้สน 1x6")
    assert result == 2


def test_no_match_returns_none():
    conn = make_mock_conn(rules=[(r"ไม้ยาง", 99, 5)], strategy1=None, strategy2a=None, strategy2b=None)
    result = match_product_id(conn, "something completely different")
    assert result is None


def test_empty_rules_returns_none():
    conn = make_mock_conn(rules=[], strategy1=None, strategy2a=None, strategy2b=None)
    result = match_product_id(conn, "ไม้สน")
    assert result is None
