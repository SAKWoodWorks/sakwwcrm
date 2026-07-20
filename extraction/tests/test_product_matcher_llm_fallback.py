import re
from unittest.mock import MagicMock

import pytest

import product_matcher


@pytest.fixture(autouse=True)
def clear_llm_cache():
    product_matcher._llm_match_cache.clear()
    yield
    product_matcher._llm_match_cache.clear()


def make_conn_all_tiers_miss(passes: int = 1):
    """Conn mock where strategies 1-3 all miss (description has no dimensions).

    Each full pass through _match_product_id_by_rules does exactly one
    Strategy-1 fetchone() and one Strategy-3 fetchall().
    """
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = lambda s: cursor
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.fetchone.side_effect = [None] * passes
    cursor.fetchall.side_effect = [[]] * passes
    conn.cursor.return_value = cursor
    return conn, cursor


DESCRIPTION = "Weird unmatched item (no dims)"
CATALOG = [{"id": 5, "sku_code": "SKU5", "full_name": "Test Product"}]


def _insert_rule_calls(cursor):
    return [
        call for call in cursor.execute.call_args_list
        if "product_transform_rules" in call.args[0] and "INSERT" in call.args[0]
    ]


def test_tier4_skipped_entirely_when_no_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    conn, cursor = make_conn_all_tiers_miss()
    fetch_mock = MagicMock()
    ask_mock = MagicMock()
    monkeypatch.setattr(product_matcher, "fetch_all_products", fetch_mock)
    monkeypatch.setattr(product_matcher, "ask_json", ask_mock)

    result = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result is None
    fetch_mock.assert_not_called()
    ask_mock.assert_not_called()


def test_tier4_accepted_high_confidence_match_inserts_rule(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    conn, cursor = make_conn_all_tiers_miss()
    monkeypatch.setattr(product_matcher, "fetch_all_products", lambda c: CATALOG)
    monkeypatch.setattr(
        product_matcher, "ask_json",
        lambda system, user, **kw: {"product_id": 5, "confidence": "high"},
    )

    result = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result == 5
    inserts = _insert_rule_calls(cursor)
    assert len(inserts) == 1
    pattern_arg, product_id_arg = inserts[0].args[1]
    assert pattern_arg == f"^{re.escape(DESCRIPTION)}$"
    assert product_id_arg == 5


def test_tier4_low_confidence_returns_none_and_does_not_insert(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    conn, cursor = make_conn_all_tiers_miss()
    monkeypatch.setattr(product_matcher, "fetch_all_products", lambda c: CATALOG)
    monkeypatch.setattr(
        product_matcher, "ask_json",
        lambda system, user, **kw: {"product_id": 5, "confidence": "low"},
    )

    result = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result is None
    assert _insert_rule_calls(cursor) == []


def test_tier4_rejects_product_id_not_in_catalog(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    conn, cursor = make_conn_all_tiers_miss()
    monkeypatch.setattr(product_matcher, "fetch_all_products", lambda c: CATALOG)
    monkeypatch.setattr(
        product_matcher, "ask_json",
        lambda system, user, **kw: {"product_id": 999, "confidence": "high"},
    )

    result = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result is None
    assert _insert_rule_calls(cursor) == []


def test_tier4_handles_llm_unavailable_response(monkeypatch):
    """ask_json returning None (API error) must not raise — treated as a miss."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    conn, cursor = make_conn_all_tiers_miss()
    monkeypatch.setattr(product_matcher, "fetch_all_products", lambda c: CATALOG)
    monkeypatch.setattr(product_matcher, "ask_json", lambda system, user, **kw: None)

    result = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result is None


def test_tier4_memoizes_within_process_run(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    conn, cursor = make_conn_all_tiers_miss(passes=2)
    monkeypatch.setattr(product_matcher, "fetch_all_products", lambda c: CATALOG)
    ask_mock = MagicMock(return_value={"product_id": 5, "confidence": "high"})
    monkeypatch.setattr(product_matcher, "ask_json", ask_mock)

    result1 = product_matcher.match_product_id(conn, DESCRIPTION)
    result2 = product_matcher.match_product_id(conn, DESCRIPTION)

    assert result1 == 5
    assert result2 == 5
    assert ask_mock.call_count == 1
    # Only the first (accepted) match persists a rule.
    assert len(_insert_rule_calls(cursor)) == 1
