import re
from datetime import date
from dataclasses import dataclass
from typing import Optional


@dataclass
class FilenameMetadata:
    doc_type: str
    doc_number: str
    doc_date: date
    channel: str
    salesperson: str
    payment_status: str          # 'paid' | 'pending'
    ref_doc_number: Optional[str]
    customer_short: str
    province: str


# Strips trailing Thai-text parentheticals: (สำนักงานใหญ่) or (ใบแจ้งหนี้) at end of string
_THAI_PAREN_END = re.compile(r'\s*\([^\x00-\x7F][^)]*\)\s*$')
# Unwraps province written as (PHUKET) — ASCII-only, starts+ends with letter, at string end
_ASCII_PAREN_END = re.compile(r'\s*\(([A-Za-z][A-Za-z\s\-]*[A-Za-z])\)\s*$')


def _parse_date(raw: str) -> date:
    day, month, year = raw.split("-")
    y = int(year)
    if y > 2500:
        y -= 543
    return date(y, int(month), int(day))


def _split_customer_province(text: str) -> tuple[str, str]:
    """
    Split 'customer province' segment.
    Province = ASCII word(s) after the last Thai character.
    For all-ASCII names (rare), province = last word only.
    """
    # Unwrap province-in-parens like (PHUKET) at end
    m = _ASCII_PAREN_END.search(text)
    if m:
        text = text[:m.start()].strip() + ' ' + m.group(1)

    # Remove all Thai-text parentheticals anywhere in string, e.g. (สำนักงานใหญ่)
    text = re.sub(r'\([^\x00-\x7F][^)]*\)', '', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Find last Thai character
    last_thai = -1
    for i, ch in enumerate(text):
        if ord(ch) > 127:
            last_thai = i

    if last_thai == -1:
        # All-ASCII: province = last word, customer = rest (may be empty for Shopee etc.)
        parts = text.rsplit(None, 1)
        if len(parts) == 1:
            return ('', parts[0].strip())
        return (parts[0].strip(), parts[1].strip())

    # Province = everything after last Thai char (trimmed)
    province = text[last_thai + 1:].strip()
    customer = text[:last_thai + 1].strip()
    return customer, province


def _parse_ti(stem: str, filename: str) -> FilenameMetadata:
    # Stage 1: TI_B No <num> <date> <channel> <rest>
    m = re.match(r'TI_B No\s+(\S+)\s+(\d{2}-\d{2}-\d{4})\s+(\S+)\s*', stem)
    if not m:
        raise ValueError(f"Cannot parse TAX Invoice filename: {filename!r}")
    doc_number = m.group(1).strip()
    doc_date = _parse_date(m.group(2))
    channel = m.group(3).strip()
    rest = stem[m.end():]

    # Stage 2: salesperson = everything up to first '('
    m2 = re.match(r'(.*?)\s*\(', rest)
    if not m2:
        raise ValueError(f"Cannot parse TAX Invoice filename: {filename!r}")
    salesperson = m2.group(1).strip()
    rest = rest[m2.end() - 1:]  # rewind to include '('

    # Stage 3: first paren group (payment status)
    m3 = re.match(r'\(([^)]*)\)', rest)
    if not m3:
        raise ValueError(f"Cannot parse TAX Invoice filename: {filename!r}")
    payment_raw = m3.group(1).strip()
    rest = rest[m3.end():]

    # Stage 4: optional second paren group (ref doc number)
    m4 = re.match(r'\(([^)]*)\)', rest)
    if m4:
        ref_raw = m4.group(1).strip()
        ref_doc_number = None if ref_raw in ('--', '', '-') else ref_raw
        rest = rest[m4.end():]
    else:
        # Single group — treat as ref, payment assumed pending unless group contains PAID
        ref_raw = payment_raw
        ref_doc_number = None if ref_raw in ('--', '', '-') else ref_raw
        payment_raw = ''  # will evaluate below

    rest = rest.strip()
    customer, province = _split_customer_province(rest)

    paid = '-PAID-' in payment_raw or payment_raw.startswith('PAID')
    payment_status = 'paid' if paid else 'pending'

    return FilenameMetadata(
        doc_type='tax_invoice',
        doc_number=doc_number,
        doc_date=doc_date,
        channel=channel,
        salesperson=salesperson,
        payment_status=payment_status,
        ref_doc_number=ref_doc_number,
        customer_short=customer,
        province=province,
    )


_QT_RE = re.compile(
    r"Quotation No\s+(?P<doc_number>\S+)\s+"
    r"(?P<date>\d{2}-\d{2}-\d{4})\s+"
    r"(?P<channel>\S+)\s+"
    r"(?P<salesperson>[^(]+?)\s*"
    r"\((?P<payment>[^)]*)\)\s*"
    r"(?P<rest>.+)$",
    re.UNICODE,
)


def _parse_qt(stem: str, filename: str) -> FilenameMetadata:
    m = _QT_RE.match(stem)
    if not m:
        raise ValueError(f"Cannot parse Quotation filename: {filename!r}")
    payment_raw = m.group('payment').strip()
    customer, province = _split_customer_province(m.group('rest').strip())
    paid = '-PAID-' in payment_raw or payment_raw.startswith('PAID')
    return FilenameMetadata(
        doc_type='quotation',
        doc_number=m.group('doc_number').strip(),
        doc_date=_parse_date(m.group('date')),
        channel=m.group('channel').strip(),
        salesperson=m.group('salesperson').strip(),
        payment_status='paid' if paid else 'pending',
        ref_doc_number=None,
        customer_short=customer,
        province=province,
    )


def parse_filename(filename: str) -> FilenameMetadata:
    stem = filename.rsplit('.', 1)[0]
    if stem.startswith('TI_B') or stem.startswith('TI&B') or stem.startswith('I_B'):
        if stem.startswith('TI&B'):
            stem = 'TI_B' + stem[4:]
        elif stem.startswith('I_B'):
            stem = 'TI_B' + stem[3:]  # "I_B No ..." → "TI_B No ..."
        return _parse_ti(stem, filename)
    elif stem.startswith('Quotation'):
        return _parse_qt(stem, filename)
    else:
        raise ValueError(f"Cannot parse filename (unknown type): {filename!r}")
