import pytest


@pytest.fixture(autouse=True)
def _no_ambient_anthropic_key(monkeypatch):
    """Tests must not depend on whichever ANTHROPIC_API_KEY happens to be in the
    ambient shell environment (e.g. the agent's own key). Default it to absent;
    LLM-fallback tests opt back in explicitly via monkeypatch.setenv."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


SAMPLE_TI_FILENAMES = [
    "TI_B No 256V 15-05-2026 Web Pickachu(-PAID-)(--) เคไอที PTPU.xlsx",
    "TI_B No 258V 18-05-2026 Web Pickachu (-PAID-)(179PW) ดีดี PTPU.xlsx",
    "TI_B No 257V 18-05-2026 Incall099 Yaowalee (-PAID-)(122YR) บริษัท อารีย์ เอ็กซิบิชั่น จำกัด Pathum Thani.xlsx",
]

SAMPLE_QT_FILENAMES = [
    "Quotation No 177PR 14-05-2026 Web Pickachu (--) คุณภูริ PTPU.xlsx",
    "Quotation No 176PW 14-05-2026 Web Pickachu (--) เชิงทะเลค้าไม้ Phuket.xlsx",
    "Quotation No 174PRv2 15-05-2026 Incall099 Pickachu (--) คุณไฟฟ้า Chiang Mai.xlsx",
]
