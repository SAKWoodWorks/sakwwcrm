# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev / build
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint

# Tests
npm test             # Run all Vitest tests (once)
npm run test:watch   # Vitest watch mode
npx vitest run src/__tests__/<filename>.test.ts      # Single test file

# Database (reads from .env.local)
npm run db:migrate   # prisma migrate dev
npm run db:generate  # prisma generate

# Python extraction (run from extraction/ dir, use .venv/Scripts/python on Windows)
.venv/Scripts/python batch_import.py --local-folder /path/to/folder   # Bulk import local xlsx files
.venv/Scripts/python extract_file.py --local-path "file.xlsx"         # Single file import (test/debug)
.venv/Scripts/python rewrite_sheets_from_db.py --tab both             # Rebuild Sheets from DB (--dry-run available)
.venv/Scripts/python backfill_items_to_sheets.py                      # Populate items Sheets tab after bulk DB import
.venv/Scripts/python import_products.py                               # Import products from docs/Stock.xlsx
python -m pytest tests/                                               # Python unit tests
```

## Environment Variables (.env.local)

```
DATABASE_URL                # postgresql://user:pass@host:port/db
LINE_CHANNEL_ACCESS_TOKEN   # LINE Bot API token
LINE_CHANNEL_SECRET         # LINE webhook signature secret
NOTIFY_SECRET               # Bearer token for /api/notify cron endpoint
GDRIVE_WEBHOOK_TOKEN        # Google Drive push notification token
GOOGLE_SHEETS_ID            # Google Sheets spreadsheet ID for the extraction pipeline
PYTHON_VENV_PATH            # Absolute path to Python venv executable
EXTRACTION_DIR              # Absolute path to extraction/ directory
```

`prisma.config.ts` loads `.env.local` explicitly — Prisma CLI reads it without `dotenv-cli`.

## Architecture

### Data flow

Google Drive (xlsx files) → `/api/gdrive` POST webhook → spawns Python `extract_file.py` as child process → writes to PostgreSQL + Google Sheets.

LINE messages → `/api/line/webhook` POST → registered salesperson: customer search; unregistered: name-based registration.

Cron job → `/api/notify` GET (token-authenticated) → raw SQL query for lapsed customers → LINE push messages.

### TypeScript / Next.js layer (`src/`)

- **`@/*`** resolves to `src/*`
- **`src/lib/prisma.ts`** — singleton Prisma client using `@prisma/adapter-pg`. Always import from here, never instantiate directly.
- **`src/lib/line.ts`** — `verifySignature`, `replyMessage`, `pushMessage` wrappers for LINE API.
- **API routes** use Next.js App Router (`route.ts`). Webhook routes verify signatures before any DB access.
- **UI pages** are under `src/app/crm/` — customers, documents, salespersons, products. All light mode (dark mode removed from `globals.css`).
- **Shared UI components:** `src/app/crm/documents/DocTypeBadge.tsx` (doc type pill), `src/app/crm/documents/PaymentToggle.tsx` (`"use client"` — renders badge + toggle button, calls PATCH then `router.refresh()`).
- **`PATCH /api/documents/[id]/payment`** — toggles `paymentStatus` between `paid`/`pending`. Auth-gated via `auth()`. Returns `{ ok: true, status }`.

### Next.js 15 gotchas

- `params` in route/page handlers is `Promise<{ id: string }>` — must `await params` before accessing fields.
- All pages that query the DB need `export const dynamic = "force-dynamic"` at the top.
- After a client-side `fetch` mutation, call `router.refresh()` (from `useRouter`) to re-render server components — do not use `window.location.reload()`.

### Prisma schema key points

Seven models: `Salesperson`, `Customer`, `Product`, `ProductTransformRule`, `Document`, `DocumentItem`, `SyncLog`.

`Document.docType` values: `"tax_invoice"` | `"quotation"`. `Document.paymentStatus`: `"paid"` | `"pending"` | `null`. `null` means not applicable (non-invoice doc), not "pending" — never coerce `null` to pending in UI logic.

`$queryRaw` results: PostgreSQL `bigint` columns come back as JavaScript `BigInt`; `Decimal` columns as `Prisma.Decimal`. Wrap with `Number()` before arithmetic or string formatting.

**`Prisma.Decimal` zero trap:** `Decimal(0)` is falsy. Always check `value != null` not `if (value)` before formatting optional Decimal fields — otherwise zero renders as "—".

### API route id validation pattern

```ts
const docId = parseInt(id, 10)
if (isNaN(docId) || String(docId) !== id) return 400  // catches "5abc" silently parsed as 5
```

Use this in every route that takes a numeric `:id` param.

### Python extraction layer (`extraction/`)

- **`extract_file.py`** — entry point for single file. Parses filename metadata (doc type, date, salesperson, customer) then reads xlsx cells for line items. Accepts `salesperson_override` kwarg (used when files are in named subfolders, e.g. `Quoatation/Pickachu/`).
- **`parsers/filename_parser.py`** — supports `TI_B No`, `TI&B No`, `I_B No` prefixes (all normalized to tax_invoice) and Buddhist Era dates (year > 2500 → subtract 543).
- **`product_matcher.py`** — 3-tier matching: (1) `full_name` prefix, (2) dimension + keyword regex, (3) `ProductTransformRule` regex patterns stored in DB.
- **`sheets_client.py`** — Sheets API with rate-limit sleep (1.1 s between batch calls). All numeric values passed as `float`, dates as `dd/mm/yyyy` strings. Items tab has 10 columns including `sku_code` and `product_name`.
- **`db.py`** — raw `psycopg2` queries (not Prisma). Upsert-style helpers; `SyncLog` tracks per-file status — `success` entries are skipped on re-run, `error` entries are retried.
- **`rewrite_sheets_from_db.py`** — canonical way to rebuild Sheets after bulk imports. Use instead of editing Sheets directly.
- **`backfill_items_to_sheets.py`** — run after `batch_import.py` to write DocumentItem rows to the Sheets items tab (batch_import skips Sheets; this fills the gap).

### Testing

Vitest (`npm test`). Test files in `src/__tests__/`: `prisma-singleton`, `line-client`, `line-webhook`, `notify`, `document-payment`. Vitest `globals: true` — no need to import `describe`/`it`/`expect`. Prisma and LINE clients are fully mocked — tests never hit the database or LINE API.

When `salesperson.findFirst` is called twice in a single webhook handler (lineUserId check then name check), chain mocks: `.mockResolvedValueOnce(null).mockResolvedValueOnce(salesperson)`.

Python tests live in `extraction/tests/` and cover filename_parser, xlsx_parser, product_matcher, and db helpers.
