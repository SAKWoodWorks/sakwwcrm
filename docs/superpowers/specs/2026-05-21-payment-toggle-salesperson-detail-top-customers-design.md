# Payment Toggle, Salesperson Detail & Top Customers — Design

## Goal

Three independent UI improvements: (1) toggle payment status on documents from both list and detail views, (2) a salesperson detail page with performance metrics and customer/document lists, (3) a top-10 customers table on the dashboard.

## Architecture

No schema changes. All mutations go through a new PATCH API route. All new pages are server components. Two new client components handle the payment toggle. One new route for salesperson detail.

---

## Feature 1: Mark Paid / Pending

### API Route

**File:** `src/app/api/documents/[id]/payment/route.ts`

`PATCH` handler:
- Auth check via `auth()` from `@/auth` — return 401 if no session
- Parse `id` from params, validate integer — return 400 if invalid
- Parse body `{ status: "paid" | "pending" }` — return 400 if invalid
- `prisma.document.update({ where: { id }, data: { paymentStatus: status } })`
- Return `{ ok: true, status }` JSON

Only updates `paymentStatus`. No other fields touched.

### Client Component

**File:** `src/app/crm/documents/PaymentToggle.tsx`

`"use client"` component. Props: `{ documentId: number; currentStatus: string | null }`.

Renders:
- Current status badge (paid → green "ชำระแล้ว", pending/null → yellow "รอชำระ")
- Small text button next to badge: paid → "ยกเลิก" (revert to pending), pending → "ทำเครื่องหมายชำระแล้ว"
- On click: `fetch PATCH /api/documents/${documentId}/payment` with new status → `router.refresh()` on success
- Loading state: button disabled + "..." text during request
- Error state: alert on failure (simple `window.alert`)

### Integration points

**Document detail** (`src/app/crm/documents/[id]/page.tsx`):
- Replace the `PaymentBadge` + surrounding `<div>` in the info card with `<PaymentToggle documentId={doc.id} currentStatus={doc.paymentStatus} />`
- Only rendered when `doc.docType === "tax_invoice"`
- Import `PaymentToggle` as a client component

**Documents list** (`src/app/crm/documents/page.tsx`):
- Replace the status cell content (the inline badge spans) with `<PaymentToggle documentId={d.id} currentStatus={d.paymentStatus} />` when `d.docType === "tax_invoice"`
- Non-tax-invoice rows keep the existing `—` dash
- Wrap with `<Suspense>` not needed — client component hydrates inline

---

## Feature 2: Salesperson Detail Page

**File:** `src/app/crm/salespersons/[id]/page.tsx`

Server component, `export const dynamic = "force-dynamic"`. Params: `{ id: string }` (Promise, awaited). `notFound()` on invalid/missing salesperson.

### Data

Three parallel queries:

**Query 1 — KPIs** (single `$queryRaw`):
```sql
SELECT
  s.id, s.name, s.line_user_id, s.channel,
  COUNT(DISTINCT c.id) AS customer_count,
  COALESCE(SUM(d.total) FILTER (WHERE d.doc_type='tax_invoice'), 0) AS total_revenue,
  COALESCE(SUM(d.total) FILTER (
    WHERE d.doc_type='tax_invoice'
    AND d.doc_date >= date_trunc('month', CURRENT_DATE)
  ), 0) AS monthly_revenue,
  (SELECT COUNT(DISTINCT c2.id)
   FROM customers c2
   JOIN documents di ON di.customer_id = c2.id AND di.salesperson_id = s.id AND di.doc_type='tax_invoice'
   WHERE NOT EXISTS (
     SELECT 1 FROM documents di2
     WHERE di2.customer_id = c2.id AND di2.doc_type='tax_invoice'
       AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
   )) AS lapsed_count
FROM salespersons s
LEFT JOIN documents d ON d.salesperson_id = s.id
LEFT JOIN customers c ON c.id = d.customer_id
WHERE s.id = ${id}
GROUP BY s.id, s.name, s.line_user_id, s.channel
```

**Query 2 — Customers** (LATERAL join, top 50 by last purchase desc):
Same pattern as customers list page but filtered `WHERE d.salesperson_id = ${id}` in the LATERAL subquery. Columns: id, name, last_purchase_date, last_purchase_total.

**Query 3 — Recent documents** (Prisma findMany, 20 rows):
```ts
prisma.document.findMany({
  where: { salespersonId: id },
  orderBy: { docDate: "desc" },
  take: 20,
  select: { id, docNumber, docDate, docType, total, paymentStatus, customer: { select: { id, name } } }
})
```

### Layout

```
Back ← พนักงานขาย

[Name]  [LINE badge]

KPI row: ลูกค้า | ยอดรวม | เดือนนี้ | Lapsed

┌─────────────────────────────────────────────────┐
│ ลูกค้า (top 50)                                 │
│ name | ซื้อล่าสุด | ยอดล่าสุด                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ เอกสารล่าสุด (20 รายการ)                        │
│ วันที่ | เลขที่ | ลูกค้า | ยอด | สถานะ          │
└─────────────────────────────────────────────────┘
```

KPI row: 4 cards inline (same style as dashboard but smaller, `text-lg` value).

**Link from salespersons list:** Wrap name in `<Link href={`/crm/salespersons/${row.id}`}>` in `salespersons/page.tsx`.

---

## Feature 3: Top Customers on Dashboard

**File:** `src/app/crm/dashboard/page.tsx`

Add a second query (run in parallel with existing stats query):

```sql
SELECT
  c.id,
  c.name,
  COALESCE(SUM(d.total), 0) AS lifetime_total,
  MAX(d.doc_date) AS last_purchase_date
FROM customers c
JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
GROUP BY c.id, c.name
ORDER BY lifetime_total DESC
LIMIT 10
```

Add a table section below the 4 KPI cards:

```
Top 10 ลูกค้า (ยอดซื้อรวม)

# | ชื่อ (link) | ยอดรวม | ซื้อล่าสุด
1 | บริษัท ABC  | ฿120,000 | 15/03/2566
...
```

Rank column: 1–10, no special formatting. Name links to `/crm/customers/${c.id}`.

---

## Out of Scope

- Edit payment status history / audit log
- Salesperson monthly breakdown chart
- Salesperson edit form
- Top customers by monthly revenue (only lifetime)
- Pagination on salesperson customer list (capped at 50)
