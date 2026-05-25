-- Backfill customers.province from customers.address.
-- Run on production/server DB after pulling the app changes.

BEGIN;

WITH mapped AS (
  SELECT
    id,
    CASE
      WHEN address ~* '(กรุงเทพ|Bangkok|\mBKK\M)' THEN 'Bangkok'
      WHEN address ~* '(ปทุมธานี|Pathum\s*Thani|Pathumthani|Pathumtani)' THEN 'Pathum Thani'
      WHEN address ~* '(นนทบุรี|Nonthaburi|Nontaburi)' THEN 'Nonthaburi'
      WHEN address ~* '(สมุทรปราการ|Samut\s*Prakan|Samutprakan|Samutprakarn)' THEN 'Samut Prakan'
      WHEN address ~* '(ชลบุรี|Chonburi)' THEN 'Chonburi'
      WHEN address ~* '(เชียงใหม่|Chiang\s*Mai|Chiangmai)' THEN 'Chiang Mai'
      WHEN address ~* '(ภูเก็ต|Phuket)' THEN 'Phuket'
      WHEN address ~* '(ระยอง|Rayong)' THEN 'Rayong'
      WHEN address ~* '(นครราชสีมา|Nakhon\s*Ratchasima|Nakhonratchasima|Korat)' THEN 'Nakhon Ratchasima'
      WHEN address ~* '(นครปฐม|Nakhon\s*Pathom|Nakhonpathom)' THEN 'Nakhon Pathom'
      WHEN address ~* '(สมุทรสาคร|Samut\s*Sakhon)' THEN 'Samut Sakhon'
      WHEN address ~* '(พระนครศรีอยุธยา|อยุธยา|Ayutthaya)' THEN 'Ayutthaya'
      WHEN address ~* '(สุราษฎร์ธานี|Surat\s*Thani)' THEN 'Surat Thani'
      WHEN address ~* '(สงขลา|Songkhla)' THEN 'Songkhla'
      WHEN address ~* '(กระบี่|Krabi)' THEN 'Krabi'
      WHEN address ~* '(สระบุรี|Saraburi)' THEN 'Saraburi'
      WHEN address ~* '(เพชรบูรณ์|Phetchabun)' THEN 'Phetchabun'
      WHEN address ~* '(กาญจนบุรี|Kanchanaburi|Kanjanaburi)' THEN 'Kanchanaburi'
      WHEN address ~* '(ฉะเชิงเทรา|Chachoengsao)' THEN 'Chachoengsao'
      WHEN address ~* '(เชียงราย|Chiang\s*Rai|Chiangrai)' THEN 'Chiang Rai'
      WHEN address ~* '(ราชบุรี|Ratchaburi)' THEN 'Ratchaburi'
      WHEN address ~* '(สุรินทร์|Surin)' THEN 'Surin'
      WHEN address ~* '(กาฬสินธุ์|Kalasin)' THEN 'Kalasin'
      WHEN address ~* '(นครนายก|Nakhon\s*Nayok)' THEN 'Nakhon Nayok'
      WHEN address ~* '(น่าน|Nan)' THEN 'Nan'
      WHEN address ~* '(สุพรรณบุรี|Suphan\s*Buri)' THEN 'Suphan Buri'
      WHEN address ~* '(ลำพูน|Lamphun)' THEN 'Lamphun'
      WHEN address ~* '(นครศรีธรรมราช|Nakhon\s*Si\s*Thammarat)' THEN 'Nakhon Si Thammarat'
      WHEN address ~* '(ตาก|Tak)' THEN 'Tak'
      WHEN address ~* '(อุดรธานี|Udon\s*Thani|Udonthani)' THEN 'Udon Thani'
      WHEN address ~* '(ลำปาง|Lampang)' THEN 'Lampang'
      WHEN address ~* '(นครสวรรค์|Nakhon\s*Sawan|Nakhonsawan)' THEN 'Nakhon Sawan'
      WHEN address ~* '(ปราจีนบุรี|Prachin\s*Buri|Prachinburi)' THEN 'Prachin Buri'
      WHEN address ~* '(อุทัยธานี|Uthai\s*Thani)' THEN 'Uthai Thani'
      WHEN address ~* '(ยะลา|Yala)' THEN 'Yala'
      WHEN address ~* '(ลพบุรี|Lopburi)' THEN 'Lopburi'
      WHEN address ~* '(พังงา|Phangnga|Phang\s*Nga)' THEN 'Phangnga'
      WHEN address ~* '(พัทลุง|Phatthalung)' THEN 'Phatthalung'
      WHEN address ~* '(ประจวบคีรีขันธ์|Prachuap\s*Khiri\s*Khan)' THEN 'Prachuap Khiri Khan'
      WHEN address ~* '(ร้อยเอ็ด|Roi\s*Et)' THEN 'Roi Et'
      WHEN address ~* '(อ่างทอง|Ang\s*Thong)' THEN 'Ang Thong'
      WHEN address ~* '(จันทบุรี|Chanthaburi|Chantaburi)' THEN 'Chanthaburi'
      WHEN address ~* '(กำแพงเพชร|Kamphaeng\s*Phet)' THEN 'Kamphaeng Phet'
      WHEN address ~* '(ขอนแก่น|Khon\s*Kaen|Khonkean)' THEN 'Khon Kaen'
      WHEN address ~* '(นครพนม|Nakhon\s*Phanom)' THEN 'Nakhon Phanom'
      WHEN address ~* '(เพชรบุรี|Phetchaburi)' THEN 'Phetchaburi'
      WHEN address ~* '(สระแก้ว|Sa\s*Kaeo)' THEN 'Sa Kaeo'
      WHEN address ~* '(สมุทรสงคราม|Samut\s*Songkhram)' THEN 'Samut Songkhram'
      WHEN address ~* '(ตราด|Trat)' THEN 'Trat'
      WHEN address ~* '(อุบลราชธานี|Ubon\s*Ratchathani)' THEN 'Ubon Ratchathani'
      WHEN address ~* '(บุรีรัมย์|Buriram)' THEN 'Buriram'
      WHEN address ~* '(ชุมพร|Chumphon)' THEN 'Chumphon'
      WHEN address ~* '(พะเยา|Phayao)' THEN 'Phayao'
      WHEN address ~* '(ระนอง|Ranong)' THEN 'Ranong'
      WHEN address ~* '(ศรีสะเกษ|Si\s*Sa\s*Ket)' THEN 'Si Sa Ket'
      WHEN address ~* '(สิงห์บุรี|Sing\s*Buri)' THEN 'Sing Buri'
      WHEN address ~* '(ตรัง|Trang)' THEN 'Trang'
      WHEN address ~* '(มหาสารคาม|Maha\s*Sarakham)' THEN 'Maha Sarakham'
      WHEN address ~* '(นราธิวาส|Narathiwat)' THEN 'Narathiwat'
      WHEN address ~* '(เลย|Loei)' THEN 'Loei'
      ELSE NULL
    END AS new_province
  FROM customers
)
UPDATE customers c
SET province = mapped.new_province,
    updated_at = NOW()
FROM mapped
WHERE c.id = mapped.id
  AND c.province IS DISTINCT FROM mapped.new_province;

SELECT province, COUNT(*) AS customer_count
FROM customers
WHERE province IS NOT NULL
GROUP BY province
ORDER BY customer_count DESC, province
LIMIT 50;

SELECT province, COUNT(*) AS suspicious_count
FROM customers
WHERE province IS NOT NULL
  AND (
    province ~ '^[A-Z]{2,6}$'
    OR province ILIKE '%PU%'
    OR province ILIKE '%.%'
    OR province ILIKE '%cash%'
  )
GROUP BY province
ORDER BY suspicious_count DESC, province;

COMMIT;
