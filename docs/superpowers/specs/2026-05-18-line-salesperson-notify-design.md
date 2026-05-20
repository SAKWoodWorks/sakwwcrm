# LINE Salesperson Notification — Design Spec

## Goal

Send a LINE push message to each salesperson every morning listing customers who haven't purchased in 90+ days, so they can follow up proactively.

## Architecture

```
LINE Developers Console (Messaging API)
        │
        ├── follow event ──► POST /api/line/webhook  ──► salespersons.line_user_id (DB)
        │
cron-job.org (08:00 TH daily)
        │
        └── GET /api/notify?token=SECRET
                │
                ├── query: customers with last tax_invoice > 90 days ago, grouped by salesperson
                └── LINE push message per customer → salesperson's line_user_id
```

## Components

### 1. `/api/line/webhook` (Next.js route)

Receives LINE webhook events. Validates LINE signature using `LINE_CHANNEL_SECRET` (HMAC-SHA256 on raw body vs `x-line-signature` header). Returns 200 immediately for all valid requests.

**Registration flow (two-step):**
1. `follow` event → bot replies: `"กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน (เช่น Pickachu)"`
2. `message` event (text) → match text against `salespersons.name` (case-insensitive, trimmed) → if found, save `line_user_id` to that row and reply `"ลงทะเบียนสำเร็จ ✅"` → if not found, reply `"ไม่พบชื่อในระบบ กรุณาลองใหม่"`

This avoids relying on LINE `displayName` which may not match the DB name.

### 2. `/api/notify` (Next.js route)

Protected by `NOTIFY_SECRET` query param. Called by cron-job.org daily at 08:00 Bangkok time (UTC+7 = 01:00 UTC).

Query:
```sql
SELECT
  c.id, c.name AS customer_name,
  s.line_user_id, s.name AS salesperson_name,
  MAX(d.doc_date) AS last_purchase,
  (CURRENT_DATE - MAX(d.doc_date)) AS days_since
FROM customers c
JOIN salespersons s ON s.id = c.salesperson_id
JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
WHERE s.line_user_id IS NOT NULL
GROUP BY c.id, c.name, s.id, s.line_user_id, s.name
HAVING (CURRENT_DATE - MAX(d.doc_date)) >= 90
ORDER BY s.id, days_since DESC
```

For each row, sends a LINE push message to the salesperson:
```
⚠️ [ชื่อลูกค้า] ไม่ได้ซื้อมา 95 วันแล้ว
```

**Error handling:**
- LINE API error for one message → log error, continue to next customer
- salesperson without `line_user_id` → excluded by WHERE clause
- DB error → return 500

Returns JSON: `{ sent: N, skipped: M, errors: [...] }`

### 3. Environment Variables

```env
LINE_CHANNEL_ACCESS_TOKEN=...   # from LINE Developers Console
LINE_CHANNEL_SECRET=...         # for webhook signature validation
NOTIFY_SECRET=...               # random string, used as query param by cron-job.org
```

## Setup Steps (one-time)

1. LINE Developers Console → Create Provider → Create Messaging API Channel
2. Copy Channel Access Token (long-lived) and Channel Secret to `.env.local`
3. Set webhook URL: `https://yourdomain.com/api/line/webhook`, enable webhooks
4. Each salesperson adds the bot as a LINE friend → webhook fires → `line_user_id` saved
5. cron-job.org → new job → `https://yourdomain.com/api/notify?token=SECRET` → daily 01:00 UTC (08:00 Bangkok)

## Data Model

No schema change needed. `salespersons.line_user_id` column already exists (`line_user_id VARCHAR` nullable).

## Out of Scope

- Two-way chat / reply handling
- Notification threshold customisation per salesperson (always 90 days)
- Retry logic for failed LINE messages
- Admin UI for managing line_user_id assignments
