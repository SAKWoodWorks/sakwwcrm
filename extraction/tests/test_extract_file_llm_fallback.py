from datetime import date

import pytest

import extract_file
from parsers.filename_parser import parse_filename, FilenameMetadata

BAD_FILENAME = "totally_unrecognized_filename_format.xlsx"

VALID_LLM_RESULT = {
    "doc_type": "tax_invoice",
    "doc_number": "999X",
    "doc_date": "2026-05-15",
    "channel": "Web",
    "salesperson": "Pickachu",
    "payment_status": "paid",
    "ref_doc_number": None,
    "customer_short": "ทดสอบ",
    "province": "PTPU",
}


def test_parse_filename_raises_valueerror_for_unrecognized_filename():
    with pytest.raises(ValueError):
        parse_filename(BAD_FILENAME)


def test_llm_parse_filename_returns_valid_meta_on_mocked_success(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(extract_file, "ask_json", lambda system, user, **kw: dict(VALID_LLM_RESULT))

    meta = extract_file._llm_parse_filename(BAD_FILENAME)

    assert meta == FilenameMetadata(
        doc_type="tax_invoice",
        doc_number="999X",
        doc_date=date(2026, 5, 15),
        channel="Web",
        salesperson="Pickachu",
        payment_status="paid",
        ref_doc_number=None,
        customer_short="ทดสอบ",
        province="PTPU",
    )


def test_llm_parse_filename_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # Even if something were to call the API, this must not be reached.
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: dict(VALID_LLM_RESULT))

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_returns_none_when_api_errors(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    # ask_json itself never raises (it swallows errors) — simulate that contract.
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: None)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_rejects_invalid_doc_type(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    bad = dict(VALID_LLM_RESULT, doc_type="something_else")
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: bad)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_rejects_invalid_payment_status(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    bad = dict(VALID_LLM_RESULT, payment_status="unknown")
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: bad)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_rejects_unconverted_buddhist_era_year(monkeypatch):
    """Model must convert BE->Gregorian itself; a year outside 2000-2100 is rejected
    rather than silently accepted (e.g. it forgot to subtract 543)."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    bad = dict(VALID_LLM_RESULT, doc_date="2569-05-15")
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: bad)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_rejects_unparseable_date(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    bad = dict(VALID_LLM_RESULT, doc_date="15-05-2026")  # wrong format, not ISO
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: bad)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def test_llm_parse_filename_rejects_missing_doc_number(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    bad = dict(VALID_LLM_RESULT, doc_number="")
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: bad)

    assert extract_file._llm_parse_filename(BAD_FILENAME) is None


def _fallback_flow(filename: str):
    """Mirrors the try/except wiring in extract_file.process()."""
    try:
        return parse_filename(filename)
    except ValueError:
        meta = extract_file._llm_parse_filename(filename)
        if meta is None:
            raise
        return meta


def test_fallback_flow_uses_llm_meta_when_available(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(extract_file, "ask_json", lambda system, user, **kw: dict(VALID_LLM_RESULT))

    meta = _fallback_flow(BAD_FILENAME)

    assert meta.doc_type == "tax_invoice"
    assert meta.doc_number == "999X"
    assert meta.doc_date == date(2026, 5, 15)


def test_fallback_flow_reraises_valueerror_when_llm_unavailable(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    with pytest.raises(ValueError):
        _fallback_flow(BAD_FILENAME)


def test_fallback_flow_reraises_valueerror_when_llm_returns_invalid_data(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(extract_file, "ask_json", lambda *a, **kw: {"doc_type": "nonsense"})

    with pytest.raises(ValueError):
        _fallback_flow(BAD_FILENAME)


def test_well_formed_filenames_never_invoke_llm_fallback(monkeypatch):
    """Sanity check: the fallback path is only reachable via ValueError."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    def _fail_if_called(*a, **kw):
        raise AssertionError("ask_json should not be called for a well-formed filename")

    monkeypatch.setattr(extract_file, "ask_json", _fail_if_called)

    meta = _fallback_flow("TI_B No 256V 15-05-2026 Web Pickachu(-PAID-)(--) เคไอที PTPU.xlsx")
    assert meta.doc_number == "256V"
