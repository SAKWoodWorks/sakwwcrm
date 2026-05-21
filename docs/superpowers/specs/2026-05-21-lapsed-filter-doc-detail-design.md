# Lapsed Customer Filter & Document Detail Page — Design

## Goal

Two independent UI additions: (1) filter the customers page to show only lapsed buyers (>90 days since last tax invoice), and (2) a document detail page showing header info plus line items.

## Architecture

No new API routes. Both features are server-side Next.js pages. The lapsed filter adds one search param to the existing customers `$queryRaw`. The document detail page is a new route that does two Prisma queries (document header + items).

---

## Feature 1: Lapsed Customer Filter

**File:** `src/app/crm/customers/page.tsx`

Add `lapsed` search param (value `"1"`). When active, append a `WHERE` clause to the existing LATERAL-join query:

```sql
AND last_inv.doc_date IS NOT NULL
AND last_inv.doc_date < CURRENT_DATE - INTERVAL '90 days'
```

UI: a toggle chip above the customers table. When `lapsed=1` is in the URL the chip is filled (blue); otherwise outline. Clicking the filled chip navigates to `/crm/customers` (clears param); clicking the outline chip navigates to `/crm/customers?lapsed=1`. Existing `q`, `sort`, `order`, and `page` params are cleared when toggling lapsed (avoids stale pagination).

Dashboard lapsed card link changes from `/crm/customers` to `/crm/customers?lapsed=1`.

**File:** `src/app/crm/dashboard/page.tsx` — update `href` on lapsed card.

---

## Feature 2: Document Detail Page

### Route

`src/app/crm/documents/[id]/page.tsx` — server component, `export const dynamic = "force-dynamic"`.

### Data fetching

Two sequential queries:

1. `prisma.document.findUnique({ where: { id }, include: { customer: true, salesperson: true } })` — returns header fields plus customer name/id and salesperson name.
2. `prisma.documentItem.findMany({ where: { documentId: id }, orderBy: { lineNo: "asc" } })` — returns line items.

If document not found, call `notFound()`.

### Layout — two-column (design B)

```
┌────────────────────────────────────────────────────────────┐
│  TAX-2566-001   [TAX Invoice badge]          [Back button] │
├──────────────────────┬─────────────────────────────────────┤
│  Info card           │  Items table                        │
│  วันที่: …           │  # | รายการ | จำนวน | หน่วย |     │
│  ลูกค้า: …(link)     │    | ราคา/หน่วย | รวม | SKU        │
│  พนักงาน: …          │  ─────────────────────────────────  │
│  ช่องทาง: …          │  row 1                              │
│  สถานะ: badge        │  row 2                              │
│  ─────────────────── │  …                                  │
│  Subtotal: ฿…        │                                     │
│  VAT 7%: ฿…          │                                     │
│  Total: ฿… (bold)    │                                     │
│  ─────────────────── │                                     │
│  หมายเหตุ: …         │                                     │
└──────────────────────┴─────────────────────────────────────┘
```

Left card: `flex-shrink-0 w-64` (fixed width). Right table: `flex-1 overflow-auto`. On mobile (< md) stack vertically.

Items table columns: `#` (lineNo), รายการ (description), จำนวน (qty), หน่วย (unit), ราคา/หน่วย (unitPrice), รวม (total), SKU. Total column right-aligned. SKU shown in muted gray.

Back button: `← เอกสาร` linking to `/crm/documents` (preserves no params — user can re-filter from list).

### Links into this page

- `src/app/crm/documents/page.tsx`: make `docNumber` cell a link → `/crm/documents/${doc.id}`.
- `src/app/crm/customers/[id]/page.tsx`: in the documents table, make `docNumber` cell a link → `/crm/documents/${doc.id}` (currently shows raw string).

### PaymentStatus badge reuse

`DocTypeBadge` already exists in documents list. For payment status, inline badge: paid → green, pending → yellow/amber.

---

## Out of Scope

- Edit or delete document from detail page
- Print / PDF export
- Document create form
- Inline item editing
