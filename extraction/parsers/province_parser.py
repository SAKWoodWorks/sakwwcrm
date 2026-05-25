import re


PROVINCE_PATTERNS = [
    ("Bangkok", [r"กรุงเทพ(?:มหานคร)?", r"\bBangkok\b", r"\bBKK\b"]),
    ("Pathum Thani", [r"ปทุมธานี", r"\bPathum\s*Thani\b", r"\bPathumthani\b", r"\bPathumtani\b"]),
    ("Nonthaburi", [r"นนทบุรี", r"\bNonthaburi\b", r"\bNontaburi\b"]),
    ("Samut Prakan", [r"สมุทรปราการ", r"\bSamut\s*Prakan\b", r"\bSamutprakan\b", r"\bSamutprakarn\b"]),
    ("Chonburi", [r"ชลบุรี", r"\bChonburi\b"]),
    ("Chiang Mai", [r"เชียงใหม่", r"\bChiang\s*Mai\b", r"\bChiangmai\b"]),
    ("Phuket", [r"ภูเก็ต", r"\bPhuket\b"]),
    ("Rayong", [r"ระยอง", r"\bRayong\b"]),
    ("Nakhon Ratchasima", [r"นครราชสีมา", r"\bNakhon\s*Ratchasima\b", r"\bNakhonratchasima\b", r"\bKorat\b"]),
    ("Nakhon Pathom", [r"นครปฐม", r"\bNakhon\s*Pathom\b", r"\bNakhonpathom\b"]),
    ("Samut Sakhon", [r"สมุทรสาคร", r"\bSamut\s*Sakhon\b"]),
    ("Ayutthaya", [r"พระนครศรีอยุธยา", r"อยุธยา", r"\bAyutthaya\b"]),
    ("Surat Thani", [r"สุราษฎร์ธานี", r"\bSurat\s*Thani\b"]),
    ("Songkhla", [r"สงขลา", r"\bSongkhla\b"]),
    ("Krabi", [r"กระบี่", r"\bKrabi\b"]),
    ("Saraburi", [r"สระบุรี", r"\bSaraburi\b"]),
    ("Phetchabun", [r"เพชรบูรณ์", r"\bPhetchabun\b"]),
    ("Kanchanaburi", [r"กาญจนบุรี", r"\bKanchanaburi\b", r"\bKanjanaburi\b"]),
    ("Chachoengsao", [r"ฉะเชิงเทรา", r"\bChachoengsao\b"]),
    ("Chiang Rai", [r"เชียงราย", r"\bChiang\s*Rai\b", r"\bChiangrai\b"]),
    ("Ratchaburi", [r"ราชบุรี", r"\bRatchaburi\b"]),
    ("Surin", [r"สุรินทร์", r"\bSurin\b"]),
    ("Kalasin", [r"กาฬสินธุ์", r"\bKalasin\b"]),
    ("Nakhon Nayok", [r"นครนายก", r"\bNakhon\s*Nayok\b"]),
    ("Nan", [r"น่าน", r"\bNan\b"]),
    ("Suphan Buri", [r"สุพรรณบุรี", r"\bSuphan\s*Buri\b"]),
    ("Lamphun", [r"ลำพูน", r"\bLamphun\b"]),
    ("Nakhon Si Thammarat", [r"นครศรีธรรมราช", r"\bNakhon\s*Si\s*Thammarat\b"]),
    ("Tak", [r"ตาก", r"\bTak\b"]),
    ("Udon Thani", [r"อุดรธานี", r"\bUdon\s*Thani\b", r"\bUdonthani\b"]),
    ("Lampang", [r"ลำปาง", r"\bLampang\b"]),
    ("Nakhon Sawan", [r"นครสวรรค์", r"\bNakhon\s*Sawan\b", r"\bNakhonsawan\b"]),
    ("Prachin Buri", [r"ปราจีนบุรี", r"\bPrachin\s*Buri\b", r"\bPrachinburi\b"]),
    ("Uthai Thani", [r"อุทัยธานี", r"\bUthai\s*Thani\b"]),
    ("Yala", [r"ยะลา", r"\bYala\b"]),
    ("Loei", [r"เลย", r"\bLoei\b"]),
    ("Lopburi", [r"ลพบุรี", r"\bLopburi\b"]),
    ("Phangnga", [r"พังงา", r"\bPhangnga\b", r"\bPhang\s*Nga\b"]),
    ("Phatthalung", [r"พัทลุง", r"\bPhatthalung\b"]),
    ("Prachuap Khiri Khan", [r"ประจวบคีรีขันธ์", r"\bPrachuap\s*Khiri\s*Khan\b"]),
    ("Roi Et", [r"ร้อยเอ็ด", r"\bRoi\s*Et\b"]),
    ("Ang Thong", [r"อ่างทอง", r"\bAng\s*Thong\b"]),
    ("Chanthaburi", [r"จันทบุรี", r"\bChanthaburi\b", r"\bChantaburi\b"]),
    ("Kamphaeng Phet", [r"กำแพงเพชร", r"\bKamphaeng\s*Phet\b"]),
    ("Khon Kaen", [r"ขอนแก่น", r"\bKhon\s*Kaen\b", r"\bKhonkean\b"]),
    ("Nakhon Phanom", [r"นครพนม", r"\bNakhon\s*Phanom\b"]),
    ("Phetchaburi", [r"เพชรบุรี", r"\bPhetchaburi\b"]),
    ("Sa Kaeo", [r"สระแก้ว", r"\bSa\s*Kaeo\b"]),
    ("Samut Songkhram", [r"สมุทรสงคราม", r"\bSamut\s*Songkhram\b"]),
    ("Trat", [r"ตราด", r"\bTrat\b"]),
    ("Ubon Ratchathani", [r"อุบลราชธานี", r"\bUbon\s*Ratchathani\b"]),
    ("Buriram", [r"บุรีรัมย์", r"\bBuriram\b"]),
    ("Chumphon", [r"ชุมพร", r"\bChumphon\b"]),
    ("Phayao", [r"พะเยา", r"\bPhayao\b"]),
    ("Ranong", [r"ระนอง", r"\bRanong\b"]),
    ("Si Sa Ket", [r"ศรีสะเกษ", r"\bSi\s*Sa\s*Ket\b"]),
    ("Sing Buri", [r"สิงห์บุรี", r"\bSing\s*Buri\b"]),
    ("Trang", [r"ตรัง", r"\bTrang\b"]),
    ("Maha Sarakham", [r"มหาสารคาม", r"\bMaha\s*Sarakham\b"]),
    ("Narathiwat", [r"นราธิวาส", r"\bNarathiwat\b"]),
]


def extract_province_from_address(address: str | None) -> str | None:
    if not address:
        return None

    normalized = re.sub(r"\s+", " ", address).strip()
    if not normalized:
        return None

    for province, patterns in PROVINCE_PATTERNS:
        if any(re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns):
            return province

    return None
