# SAK Woodworks CRM

Internal CRM for a wood products distributor. Tracks customers, documents (tax invoices / quotations), products, and salespersons. Integrates with Google Drive for automatic document ingestion and LINE for salesperson notifications.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Database:** PostgreSQL via Prisma ORM (`@prisma/adapter-pg`)
- **Auth:** NextAuth v5 (Google OAuth, restricted to `@sakww.com`)
- **Styling:** Tailwind CSS (light mode only)
- **Tests:** Vitest (unit, no real DB)
- **Python pipeline:** Python 3 + openpyxl + psycopg2 + Google Sheets API

## Infrastructure

- **Production:** Digital Ocean Droplet running Docker (`docker-compose.yml`)
  - `db` — postgres:16-alpine (port 127.0.0.1:5432)
  - `pgadmin` — pgAdmin 4 (port 5050)
  - `crm` — Next.js app (port 8008→8007)
- **Local dev DB:** SSH tunnel to server `ssh -L 5432:localhost:5432 -o ServerAliveInterval=60 info@157.245.207.55 -N`; `DATABASE_URL` points to `localhost:5432`
- **Deploy:** `git pull && docker compose up -d --build` on server
- **Schema changes:** Run `ALTER TABLE` directly via `docker exec -i <db-container> psql` — `prisma migrate dev` has advisory lock issues on this server

## Pages

| Path | Description |
|------|-------------|
| `/crm/dashboard` | KPI cards (customers, new this month, revenue, invoices, pending invoices, lapsed) + Quotation vs Invoice table + top 10 customers |
| `/crm/customers` | Customer list with search, sort, lapsed filters (30–59 / 60–89 / 90–364 / 365+ days) |
| `/crm/customers/[id]` | Customer detail: info + document history |
| `/crm/customers/[id]/edit` | Edit customer form |
| `/crm/documents` | Document list with type/payment filters |
| `/crm/documents/[id]` | Document detail: header info + line items |
| `/crm/salespersons` | Salesperson list |
| `/crm/salespersons/[id]` | Salesperson detail: KPIs + customers + recent documents + LINE link/unlink |
| `/crm/products` | Product catalog |

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/customers/[id]` | PATCH | Update customer fields; status allowlist `["not_purchase_yet","active","inactive"]` |
| `/api/documents/[id]/payment` | PATCH | Toggle `paymentStatus` between `paid` / `pending` |
| `/api/salespersons/[id]/line` | DELETE | Unlink LINE (clears lineUserId, linkCode, linkCodeExpiresAt) |
| `/api/salespersons/[id]/line/code` | POST | Generate 6-char one-time link code (15 min expiry); 409 if already linked |
| `/api/gdrive` | POST | Google Drive push webhook → spawns Python `extract_file.py` |
| `/api/line/webhook` | POST | LINE messages → customer search (registered) or code/name registration (new) |
| `/api/notify` | GET | Cron endpoint: pushes LINE alerts for lapsed customers (>90 days) |

## Data Flow

### Document ingestion
```
xlsx file uploaded to Google Drive
  → Drive push notification → POST /api/gdrive
  → spawns extraction/extract_file.py as child process
  → parses filename (doc type, date, salesperson, customer)
  → reads xlsx cells for line items
  → writes to PostgreSQL + Google Sheets
```

### LINE integration
```
Salesperson messages LINE bot
  → POST /api/line/webhook (HMAC-SHA256 verified)
  → if lineUserId registered → customer search (returns up to 3 matches with doc history)
  → if not registered:
      1. check linkCode + expiry → if match: link account, clear code
      2. check if code exists (any expiry) → if yes: reply "รหัสหมดอายุ"
      3. name-match → if match: link account
      4. else: reply "ไม่พบชื่อในระบบ"
```

### Salesperson LINE registration (admin flow)
```
Admin opens salesperson detail page
  → clicks "สร้าง Link Code" → POST /api/salespersons/[id]/line/code
  → 6-char code displayed (15 min expiry)
  → salesperson types code in LINE bot → webhook links account
Admin can unlink via "ยกเลิก LINE" → DELETE /api/salespersons/[id]/line
```

### Lapsed customer alerts
```
Cron hits GET /api/notify?token=<secret>
  → queries customers with last tax_invoice > 90 days ago
    whose salesperson has lineUserId set
  → pushes LINE message per customer to assigned salesperson
```

## Data Model (key fields)

**Document**
- `docType`: `"tax_invoice"` | `"quotation"`
- `paymentStatus`: `"paid"` | `"pending"` | `null` (null = not applicable, not pending)
- `subtotal`, `vat`, `total`: `Decimal` — use `!= null` not truthiness (0.00 is falsy)

**Customer**
- `status`: `"not_purchase_yet"` | `"active"` | `"inactive"`
- `vatRegistered`: boolean — validate as `=== true` not truthy (string `"false"` is truthy)

**Salesperson**
- `lineUserId`: set via LINE registration; `null` = not connected
- `linkCode`: 6-char one-time code for LINE registration (charset: A-Z excluding I/O, 2-9 excluding 0/1)
- `linkCodeExpiresAt`: 15 minutes from generation

**SyncLog** — tracks per-file extraction status; `success` entries skipped on re-run, `error` entries retried.

## Python Extraction Pipeline

Run from `extraction/` directory using `.venv/Scripts/python` on Windows.

| Script | Purpose |
|--------|---------|
| `batch_import.py` | Bulk import local xlsx folder |
| `extract_file.py` | Single file import (also called by gdrive webhook) |
| `rewrite_sheets_from_db.py` | Rebuild Google Sheets from DB (use after bulk imports) |
| `backfill_items_to_sheets.py` | Write DocumentItem rows to Sheets after batch import |
| `import_products.py` | Import product catalog from `docs/Stock.xlsx` |

Filename parser supports `TI_B No`, `TI&B No`, `I_B No` prefixes (all → `tax_invoice`) and Buddhist Era dates (year > 2500 → subtract 543).

Product matching uses 3-tier lookup: full_name prefix → dimension + keyword regex → `ProductTransformRule` regex patterns stored in DB.

## Key Implementation Notes

- All DB-querying pages use `export const dynamic = "force-dynamic"`
- `params` in App Router are `Promise<{ id: string }>` — must `await`
- `$queryRaw` returns PostgreSQL `bigint` as JS `BigInt` → wrap with `Number()`
- `Prisma.Decimal` for value 0 is falsy — always check `!= null` not `if (value)`
- After client-side mutations call `router.refresh()` before `router.push()` to re-render server components
- Middleware bypasses auth for `/api/line`, `/api/notify`, `/api/gdrive`
- ID validation: `parseInt(id, 10)` + `String(id) !== rawId` guard in every numeric route

## Environment Variables

```
DATABASE_URL                # postgresql://...
LINE_CHANNEL_ACCESS_TOKEN   # LINE Bot API token
LINE_CHANNEL_SECRET         # webhook HMAC secret
NOTIFY_SECRET               # cron endpoint bearer token
GDRIVE_WEBHOOK_TOKEN        # Drive push notification token
GOOGLE_SHEETS_ID            # Sheets spreadsheet ID
PYTHON_VENV_PATH            # absolute path to venv Python executable
EXTRACTION_DIR              # absolute path to extraction/ directory
AUTH_SECRET                 # NextAuth secret
GOOGLE_CLIENT_ID            # Google OAuth client ID
GOOGLE_CLIENT_SECRET        # Google OAuth client secret
```
