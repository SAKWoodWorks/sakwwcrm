"""Shared Claude API helper for optional LLM-powered fallback features.

Defensive by design: every failure mode (missing API key, network/API error,
malformed response) degrades to `None` / `False` so callers can fall back to
existing deterministic behavior without special-casing exceptions.
"""
import json
import os
import sys

import anthropic

MODEL = "claude-fable-5"


def llm_available() -> bool:
    """True if an Anthropic API key is configured in the environment."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]  # drop opening fence (``` or ```json)
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]  # drop closing fence
        text = "\n".join(lines).strip()
    return text


def ask_json(system: str, user: str, max_tokens: int = 1024) -> dict | None:
    """Ask Claude a question and parse the reply as JSON.

    Returns None on ANY failure (missing key, API error, bad JSON) — never
    raises. Callers must treat None as "fallback unavailable" and preserve
    whatever behavior they had before this helper existed.
    """
    if not llm_available():
        return None
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        response = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = _strip_code_fence(response.content[0].text)
        return json.loads(text)
    except Exception as e:
        print(f"[llm_client] warning: LLM call failed: {e}", file=sys.stderr)
        return None
