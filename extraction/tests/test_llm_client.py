from unittest.mock import MagicMock, patch

import llm_client


def _mock_response(text: str):
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


def test_llm_available_true_when_key_set(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    assert llm_client.llm_available() is True


def test_llm_available_false_when_key_missing(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert llm_client.llm_available() is False


def test_ask_json_strips_markdown_code_fence_and_parses(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _mock_response('```json\n{"a": 1}\n```')
    with patch.object(llm_client.anthropic, "Anthropic", return_value=mock_client):
        result = llm_client.ask_json("system", "user")
    assert result == {"a": 1}


def test_ask_json_parses_plain_json_without_fence(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _mock_response('{"b": 2}')
    with patch.object(llm_client.anthropic, "Anthropic", return_value=mock_client):
        result = llm_client.ask_json("system", "user")
    assert result == {"b": 2}


def test_ask_json_returns_none_on_api_exception(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = RuntimeError("boom")
    with patch.object(llm_client.anthropic, "Anthropic", return_value=mock_client):
        result = llm_client.ask_json("system", "user")
    assert result is None


def test_ask_json_returns_none_on_malformed_json(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _mock_response("not valid json at all")
    with patch.object(llm_client.anthropic, "Anthropic", return_value=mock_client):
        result = llm_client.ask_json("system", "user")
    assert result is None


def test_ask_json_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = llm_client.ask_json("system", "user")
    assert result is None


def test_ask_json_calls_model_with_expected_params_and_no_sampling_kwargs(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _mock_response('{"x": 1}')
    with patch.object(llm_client.anthropic, "Anthropic", return_value=mock_client):
        llm_client.ask_json("sys-prompt", "user-prompt", max_tokens=256)

    kwargs = mock_client.messages.create.call_args.kwargs
    assert kwargs["model"] == "claude-fable-5"
    assert kwargs["max_tokens"] == 256
    assert kwargs["system"] == "sys-prompt"
    assert kwargs["messages"] == [{"role": "user", "content": "user-prompt"}]
    # Newest Claude models 400 on these — must never be sent.
    assert "temperature" not in kwargs
    assert "top_p" not in kwargs
    assert "top_k" not in kwargs
