# CRM Extraction System Design

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** Extract TAX Invoice + Quotation from Google Drive → PostgreSQL + Google Sheets → CRM Web + LINE Bot

---

## 1. Architecture Overview

```
DigitalOcean Droplet
├── Next.js App
│     ├── /api/gdrive     ← Google Drive Watch webhook receiver
│     ├── /api/line       ← LINE Messaging API webhook
│     └── /crm/**         ← CRM web pages
│
└── Python Worker (invoked by Next.js webhook handler)
      └── extraction pipeline → PostgreSQL + Google Sheets

External:
  Google Drive → Watch API → /api/gdrive
  LINE → Messaging API → /api/line
  Browser → /crm
```

**Stack:**
- Extraction: Python (openpyxl, google-api-python-client)
- Web + Webhooks: Next.js (App Router, Prisma, TailwindCSS)
- Database: PostgreSQL on DigitalOcean
- Notifications/Query: LINE Messaging API

---

## 2. Data Model

```sql
-- ─── STAFF / SALESPERSONS ───────────────────────────────────────────────────
salespersons
  id            SERIAL PRIMARY KEY
  name          TEXT NOT NULL          -- "Pickachu", "Yaowalee", etc.
  channel       TEXT                   -- primary channel: "Web", "Incall099"
  line_user_id  TEXT                   -- for direct LINE notifications to salesperson
  active        BOOLEAN DEFAULT TRUE
  created_at    TIMESTAMPTZ DEFAULT NOW()

-- ─── CUSTOMERS ──────────────────────────────────────────────────────────────
customers
  id                  SERIAL PRIMARY KEY
  name                TEXT NOT NULL
  tax_id              TEXT UNIQUE            -- null if individual (no TAX ID)
  vat_registered      BOOLEAN DEFAULT TRUE   -- VAT/NOVAT flag
  type                TEXT                   -- 'retail' | 'dealer' | 'lazada' | 'thai_watsadu' | ...
  status              TEXT DEFAULT 'not_purchase_yet'  -- 'not_purchase_yet' | 'active' | 'repeat'
  address             TEXT
  province            TEXT                   -- "Pathum Thani", "Phuket", "PTPU", etc.
  phone               TEXT
  email               TEXT
  line_id             TEXT                   -- LINE contact of customer
  other_id            TEXT                   -- other platform ID (Shopee, Lazada seller ID, etc.)
  account_manager_id  INT REFERENCES salespersons(id)
  created_at          TIMESTAMPTZ DEFAULT NOW()
  updated_at          TIMESTAMPTZ DEFAULT NOW()

-- ─── PRODUCTS / SKU ─────────────────────────────────────────────────────────
products
  id                    SERIAL PRIMARY KEY
  sku_code              TEXT UNIQUE NOT NULL
  full_name             TEXT NOT NULL
  color                 TEXT
  grade                 TEXT                 -- "A", "B", "C"
  thickness             NUMERIC(8,2)         -- mm
  height                NUMERIC(8,2)         -- mm
  width                 NUMERIC(8,2)         -- mm
  weight                NUMERIC(8,3)         -- kg
  volume                NUMERIC(10,4)        -- m³
  ws_cost               NUMERIC(12,2)        -- wholesale cost
  rt_cost               NUMERIC(12,2)        -- retail cost
  date_last_cost_adj    DATE
  -- cached stats (updated after each document insert)
  date_last_invoice     DATE
  total_qty_invoiced    NUMERIC(12,3)
  total_amount_invoiced NUMERIC(14,2)
  total_qty_quoted      NUMERIC(12,3)
  total_amount_quoted   NUMERIC(14,2)
  created_at            TIMESTAMPTZ DEFAULT NOW()
  updated_at            TIMESTAMPTZ DEFAULT NOW()

-- maps description text from xlsx → product SKU (regex or keyword)
product_transform_rules
  id          SERIAL PRIMARY KEY
  pattern     TEXT NOT NULL        -- regex matched against document_items.description
  product_id  INT REFERENCES products(id)
  priority    INT DEFAULT 0        -- higher = tried first when multiple rules match

-- ─── DOCUMENTS ──────────────────────────────────────────────────────────────
documents
  id              SERIAL PRIMARY KEY
  doc_type        TEXT NOT NULL          -- 'tax_invoice' | 'quotation'
  doc_number      TEXT NOT NULL          -- "256V", "177PR"
  doc_date        DATE NOT NULL
  channel         TEXT                   -- "Web", "Incall099"
  salesperson_id  INT REFERENCES salespersons(id)
  payment_status  TEXT                   -- 'paid' | 'pending'
  ref_doc_number  TEXT                   -- quotation ref on TAX Invoice e.g. "179PW"
  customer_id     INT REFERENCES customers(id)
  subtotal        NUMERIC(12,2)          -- price ex-VAT
  vat             NUMERIC(12,2)          -- VAT 7%
  total           NUMERIC(12,2)          -- total inc VAT
  notes           TEXT
  gdrive_file_id  TEXT UNIQUE            -- prevents duplicate processing
  gdrive_filename TEXT
  created_at      TIMESTAMPTZ DEFAULT NOW()

document_items
  id            SERIAL PRIMARY KEY
  document_id   INT REFERENCES documents(id) ON DELETE CASCADE
  line_no       INT
  description   TEXT
  quantity      NUMERIC(10,3)
  unit          TEXT                   -- "piece (แผ่น)"
  unit_price    NUMERIC(12,2)
  total         NUMERIC(12,2)
  product_id    INT REFERENCES products(id)  -- NULL if no rule matched

-- ─── SYNC LOG ───────────────────────────────────────────────────────────────
sync_log
  id            SERIAL PRIMARY KEY
  gdrive_file_id TEXT
  filename      TEXT
  status        TEXT                   -- 'success' | 'error'
  error_msg     TEXT
  processed_at  TIMESTAMPTZ DEFAULT NOW()
```

**Key decisions:**
- `customers` deduplicated by `tax_id`; fallback to name ILIKE for individuals
- `customers.type` segments by channel: retail / dealer / lazada / thai_watsadu
- `customers.status` lifecycle: not_purchase_yet → active → repeat
- `customers.account_manager_id` → same `salespersons` table (salesperson = account manager)
- `products` + `product_transform_rules` map raw description text to SKU — rules applied at extraction time
- `documents` unifies TAX Invoice + Quotation, differentiated by `doc_type`
- `ref_doc_number` links TAX Invoice back to source Quotation
- `gdrive_file_id UNIQUE` makes all processing idempotent
- `salespersons` auto-upserted on extraction; new names inserted automatically

---

## 3. Extraction Pipeline

### 3.1 Filename Patterns

```python
# TAX Invoice: TI_B No 256V 15-05-2026 Web Pickachu(-PAID-)(--) เคไอที PTPU.xlsx
TI_PATTERN = (
    r"TI_B No (?P<doc_number>\S+) (?P<date>\d{2}-\d{2}-\d{4}) "
    r"(?P<channel>\S+) (?P<salesperson>[^(\-]+?)\s*"
    r"\((?P<payment>[^)]*)\)\((?P<ref>[^)]*)\)\s*"
    r"(?P<customer>.+?)\s+(?P<province>\S+)\.xlsx"
)

# Quotation: Quotation No 177PR 14-05-2026 Web Pickachu (--) คุณภูริ PTPU.xlsx
QT_PATTERN = (
    r"Quotation No (?P<doc_number>\S+) (?P<date>\d{2}-\d{2}-\d{4}) "
    r"(?P<channel>\S+) (?P<salesperson>[^(]+?)\s*"
    r"\((?P<payment>[^)]*)\)\s*"
    r"(?P<customer>.+?)\s+(?P<province>\S+)\.xlsx"
)
```

Payment status: `-PAID-` → `paid`, `--` → `pending`

### 3.2 xlsx Cell Map (TAX Invoice)

| Field | Cell |
|-------|------|
| doc_number | O9 |
| doc_date | Y9 (Thai Buddhist year → subtract 543) |
| customer name + TAX ID | B11 (combined string, split on "TAX ID :") |
| address line 1 | B12 |
| address line 2 | B13 |
| items rows | 18–45: A(no) B(desc) Q(qty) T(unit) W(unit_price) Z(total) |
| total inc VAT | X49 |
| subtotal ex-VAT | X49/107*100 |
| VAT | X49/107*7 |
| notes | C51 |

Quotation cell map: to be confirmed against sample file during implementation (expected to be similar structure).

### 3.3 Real-time Pipeline Flow

```
POST /api/gdrive (webhook)
  │
  ├─ validate Google Drive webhook signature
  ├─ extract gdrive_file_id from payload
  ├─ spawn Python worker: python extract_file.py --file-id {id}
  └─ return 200 immediately (async, do not block webhook)

extract_file.py:
  ├─ CHECK sync_log: file_id exists + status=success? → exit (idempotent)
  ├─ DOWNLOAD file via Google Drive API
  ├─ DETECT type from filename (TI_B / Quotation)
  ├─ PARSE filename → metadata
  ├─ PARSE xlsx → customer, items, totals, notes
  ├─ UPSERT salesperson
  ├─ UPSERT customer (match tax_id → fallback name ILIKE)
  ├─ For each item: match description vs product_transform_rules → set product_id
  ├─ INSERT document + document_items (transaction)
  ├─ UPDATE products cached stats (date_last_invoice, total_amount_invoiced, etc.)
  ├─ APPEND row to Google Sheets
  └─ INSERT sync_log (success) — on any error: INSERT sync_log (error, msg)
```

### 3.4 Batch Import (Historical Data)

Script: `batch_import.py`

```bash
python batch_import.py --folder TAX-Invoices
python batch_import.py --folder Quoatation --year 2024
python batch_import.py --all
```

Flow:
1. LIST all files in target Google Drive folder(s)
2. For each file: check sync_log → skip if already imported
3. Pass through same extraction pipeline (reuse extract_file.py logic)
4. Rate limit: `sleep(0.1)` between files (Google Drive API: 1,000 req/100s)
5. Google Sheets: use `batchUpdate` instead of per-row append
6. Report: `success X / skipped Y (already imported) / error Z`
7. Export `error_report.csv` for failed files

Idempotent: can be re-run any number of times safely.

---

## 4. LINE Bot

**Webhook:** `POST /api/line` (Next.js API route)

### Intent Matching (keyword-based, no AI needed)

| User input | Intent | Query |
|-----------|--------|-------|
| `"[ชื่อลูกค้า]"` | customer lookup | search by name ILIKE |
| `"[ชื่อ] ล่าสุด"` / `"ซื้อครั้งล่าสุด"` | last purchase | latest tax_invoice for customer |
| `"[ชื่อ] นานไหม"` / `"ไม่ได้ซื้อ"` | inactivity check | days since last purchase |
| `"ไม่ได้ซื้อ 30 วัน"` | inactive list | all customers inactive > N days |

### Key Queries

```sql
-- Last purchase for customer
SELECT d.doc_date, d.doc_number, d.total
FROM documents d
JOIN customers c ON c.id = d.customer_id
WHERE d.doc_type = 'tax_invoice'
  AND c.name ILIKE '%{name}%'
ORDER BY d.doc_date DESC LIMIT 1;

-- Customers inactive > N days
SELECT c.name, MAX(d.doc_date) AS last_purchase,
       NOW()::date - MAX(d.doc_date) AS days_since
FROM customers c
LEFT JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
GROUP BY c.id, c.name
HAVING NOW()::date - MAX(d.doc_date) > {N}
ORDER BY days_since DESC;
```

---

## 5. CRM Web (Basic)

3 pages only:

| Route | Content |
|-------|---------|
| `/crm/customers` | Table: name, tax_id, province, last purchase date, total spend. Search by name/TAX ID. |
| `/crm/customers/[id]` | Customer detail: info + all documents (date, doc_number, type, total, status) |
| `/crm/documents` | All invoices + quotations. Filter: doc_type, channel, salesperson, date range. |

**Stack:** Next.js App Router + Prisma ORM + TailwindCSS

---

## 6. Deployment (DigitalOcean Droplet)

```
Droplet
├── Next.js → PM2 (port 3000, behind nginx)
├── Python venv → invoked by Next.js webhook handler
├── PostgreSQL → DigitalOcean Managed Database (or self-hosted)
└── nginx → reverse proxy + SSL (Let's Encrypt)

Environment variables:
  DATABASE_URL
  GOOGLE_SERVICE_ACCOUNT_JSON
  GOOGLE_DRIVE_FOLDER_IDS (TAX-Invoices, Quotation)
  GOOGLE_SHEETS_ID
  LINE_CHANNEL_SECRET
  LINE_CHANNEL_ACCESS_TOKEN
```

Google Drive Watch API requires a public HTTPS webhook URL → must have domain + SSL before setup.

---

## 7. Implementation Order

1. Database schema + Prisma setup (all tables incl. products, product_transform_rules)
2. Seed `products` + `product_transform_rules` with known SKUs
3. Python extraction pipeline (filename parser + xlsx parser + DB insert + product matching)
4. Batch import script (historical data)
5. Google Drive Watch API webhook (`/api/gdrive`)
6. Google Sheets sync
7. CRM web pages (customers list → detail → documents)
8. LINE Bot webhook + intent matching
