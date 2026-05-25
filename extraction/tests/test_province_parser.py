from parsers.province_parser import extract_province_from_address


def test_extracts_thai_bangkok_from_address():
    assert extract_province_from_address("99/1 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110") == "Bangkok"


def test_extracts_thai_province_with_prefix():
    assert extract_province_from_address("88 หมู่ 3 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120") == "Pathum Thani"


def test_extracts_english_province_variants():
    assert extract_province_from_address("12 Moo 4 Bang Yai Nonthaburi 11140") == "Nonthaburi"
    assert extract_province_from_address("1 road Pathumthani 12120") == "Pathum Thani"


def test_returns_none_when_address_has_no_province():
    assert extract_province_from_address("สำนักงานใหญ่") is None
    assert extract_province_from_address("") is None
