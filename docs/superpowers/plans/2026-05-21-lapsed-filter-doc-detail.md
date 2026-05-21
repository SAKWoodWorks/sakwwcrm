# Lapsed Customer Filter & Document Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lapsed-customer toggle filter to the customers page and a new document detail page showing header info plus line items.

**Architecture:** Three server-component changes + one new page. No new API routes. Lapsed filter appends a WHERE clause to the existing `$queryRaw` in customers page. Document detail uses Prisma `findUnique` + `findMany`. Links into the detail page added from both documents list and customer detail.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/crm/customers/page.tsx` | Modify | Add `lapsed` search param + toggle chip UI |
| `src/app/crm/dashboard/page.tsx` | Modify | Update lapsed card href to `/crm/customers?lapsed=1` |
| `src/app/crm/documents/[id]/page.tsx` | Create | Document detail page (two-column layout) |
| `src/app/crm/documents/page.tsx` | Modify | Make docNumber a link to `/crm/documents/[id]` |
| `src/app/crm/customers/[id]/page.tsx` | Modify | Make docNumber a link to `/crm/documents/[id]` |

---

## Task 1: Lapsed Filter on Customers Page

**Files:**
- Modify: `src/app/crm/customers/page.tsx`

### Context

The customers page uses `$queryRaw` with a LATERAL join to get the last tax_invoice per customer. The query already has `last_inv.doc_date` available via the LATERAL subquery. The lapsed filter adds a WHERE condition on that column.

Current `Props` type:
```ts
type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string }>
}
```

Current search params destructure:
```ts
const { q, page: pageStr, sort = "last_purchase", order = "desc" } = await searchParams
```

Current `searchFilter`:
```ts
const searchFilter = q
  ? Prisma.sql`(c.name ILIKE ${`%${q}%`} OR c.tax_id ILIKE ${`%${q}%`})`
  : Prisma.sql`TRUE`
```

Current count query:
```ts
prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(*) AS count FROM customers c WHERE ${searchFilter}
`
```

- [ ] **Step 1: Add `lapsed` to Props and destructure**

Replace the `Props` type and destructure:

```ts
type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string; lapsed?: string }>
}

// inside the component:
const { q, page: pageStr, sort = "last_purchase", order = "desc", lapsed } = await searchParams
const isLapsed = lapsed === "1"
```

- [ ] **Step 2: Add lapsed WHERE clause to the SQL query**

Add a `lapsedFilter` Prisma.sql fragment and combine with `searchFilter`. Place this after the `searchFilter` definition:

```ts
const lapsedFilter = isLapsed
  ? Prisma.sql`AND last_inv.doc_date IS NOT NULL AND last_inv.doc_date < CURRENT_DATE - INTERVAL '90 days'`
  : Prisma.sql``
```

In the main query, the WHERE clause currently is `WHERE ${searchFilter}`. The LATERAL join means `last_inv` is always available (LEFT JOIN returns NULL columns when no match). Change the query's WHERE + ORDER section:

```sql
WHERE ${searchFilter}
${lapsedFilter}
ORDER BY ${orderBy}
LIMIT ${PAGE_SIZE} OFFSET ${skip}
```

The count query also needs the LATERAL join when filtering by lapsed. Replace the simple count query:

```ts
prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(*) AS count
  FROM customers c
  LEFT JOIN LATERAL (
    SELECT doc_date
    FROM documents
    WHERE customer_id = c.id AND doc_type = 'tax_invoice'
    ORDER BY doc_date DESC
    LIMIT 1
  ) last_inv ON TRUE
  WHERE ${searchFilter}
  ${lapsedFilter}
`,
```

- [ ] **Step 3: Add the lapsed toggle chip UI**

In the JSX, add the chip between the `<h1>` row and the table. The chip links clear pagination but preserve `q`, `sort`, `order`:

```tsx
{/* lapsed toggle chip — place inside the <div className="p-6"> after the mb-4 flex div */}
<div className="mb-3 flex gap-2">
  {isLapsed ? (
    <Link
      href={`/crm/customers?${q ? `q=${encodeURIComponent(q)}&` : ""}sort=${sort}&order=${order}`}
      className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
    >
      Lapsed &gt;90 วัน ✕
    </Link>
  ) : (
    <Link
      href={`/crm/customers?${q ? `q=${encodeURIComponent(q)}&` : ""}sort=${sort}&order=${order}&lapsed=1`}
      className="inline-flex items-center gap-1 rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
    >
      Lapsed &gt;90 วัน
    </Link>
  )}
</div>
```

- [ ] **Step 4: Run the dev server and verify manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000/crm/customers?lapsed=1`. Verify:
- Chip shows filled (red bg, has ✕)
- Table shows only customers whose last tax_invoice is older than 90 days (or have never purchased — which won't show because `last_inv.doc_date IS NOT NULL`)
- Clicking ✕ chip goes back to `/crm/customers` and shows all
- Customer count updates correctly

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass (no tests cover the customers page directly, but confirm no regressions in 33 existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/crm/customers/page.tsx
git commit -m "feat: lapsed >90 day filter toggle on customers page"
```

---

## Task 2: Update Dashboard Lapsed Card Link

**Files:**
- Modify: `src/app/crm/dashboard/page.tsx`

- [ ] **Step 1: Update the lapsed card href**

In `src/app/crm/dashboard/page.tsx`, find the lapsed card in the `cards` array:

```ts
{
  label: "Lapsed >90 วัน",
  value: Number(stats.lapsed_count).toLocaleString("th-TH"),
  href: "/crm/customers",          // ← change this
  color: "text-red-600",
  border: "border-red-100",
},
```

Change `href` to:

```ts
href: "/crm/customers?lapsed=1",
```

- [ ] **Step 2: Commit**

```bash
git add src/app/crm/dashboard/page.tsx
git commit -m "fix: dashboard lapsed card links to filtered customers view"
```

---

## Task 3: Document Detail Page

**Files:**
- Create: `src/app/crm/documents/[id]/page.tsx`

### Context

`Document` model fields (from schema):
- `id`, `docType`, `docNumber`, `docDate` (Date), `channel`, `salespersonId`, `paymentStatus`, `refDocNumber`, `customerId`, `subtotal`, `vat`, `total` (Decimal), `notes`
- Relations: `customer` (Customer), `salesperson` (Salesperson), `items` (DocumentItem[])

`DocumentItem` model fields:
- `id`, `documentId`, `lineNo`, `description`, `quantity` (Decimal), `unit`, `unitPrice` (Decimal), `total` (Decimal), `productId`
- Relation: `product` (Product) — has `skuCode`

`notFound()` is imported from `"next/navigation"`.

All Decimal fields must be wrapped with `Number()` before `.toLocaleString()`.

- [ ] **Step 1: Create the detail page file**

Create `src/app/crm/documents/[id]/page.tsx`:

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: Props) {
  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) notFound()

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      customer: { select: { id: true, name: true } },
      salesperson: { select: { name: true } },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          product: { select: { skuCode: true } },
        },
      },
    },
  })

  if (!doc) notFound()

  const fmt = (n: unknown) =>
    Number(n).toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    })

  const fmtQty = (n: unknown) =>
    Number(n).toLocaleString("th-TH", { maximumFractionDigits: 3 })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back + title row */}
      <div className="mb-4 flex items-center gap-4">
        <Link href="/crm/documents" className="text-sm text-blue-600 hover:underline">
          ← เอกสาร
        </Link>
        <h1 className="text-xl font-semibold font-mono">{doc.docNumber}</h1>
        <DocTypeBadge docType={doc.docType} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Left: info card */}
        <div className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-5 md:w-64">
          <dl className="space-y-2 text-sm">
            <InfoRow label="วันที่" value={doc.docDate.toLocaleDateString("th-TH")} />
            <div>
              <dt className="font-medium text-gray-500">ลูกค้า</dt>
              <dd className="mt-0.5">
                {doc.customer ? (
                  <Link
                    href={`/crm/customers/${doc.customer.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {doc.customer.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <InfoRow label="พนักงาน" value={doc.salesperson?.name ?? "—"} />
            <InfoRow label="ช่องทาง" value={doc.channel ?? "—"} />
            <div>
              <dt className="font-medium text-gray-500">สถานะ</dt>
              <dd className="mt-0.5">
                {doc.docType === "tax_invoice" ? (
                  <PaymentBadge status={doc.paymentStatus} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            {doc.refDocNumber && (
              <InfoRow label="เลขอ้างอิง" value={doc.refDocNumber} />
            )}
            <div className="border-t border-gray-100 pt-2">
              <InfoRow label="Subtotal" value={doc.subtotal ? fmt(doc.subtotal) : "—"} />
              <InfoRow label="VAT 7%" value={doc.vat ? fmt(doc.vat) : "—"} />
              <div className="mt-1">
                <dt className="font-medium text-gray-500">Total</dt>
                <dd className="mt-0.5 text-base font-bold text-gray-900">
                  {doc.total ? fmt(doc.total) : "—"}
                </dd>
              </div>
            </div>
            {doc.notes && (
              <div className="border-t border-gray-100 pt-2">
                <dt className="font-medium text-gray-500">หมายเหตุ</dt>
                <dd className="mt-0.5 text-gray-700 text-xs whitespace-pre-wrap">{doc.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Right: items table */}
        <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-500">#</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">รายการ</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">จำนวน</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">หน่วย</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">ราคา/หน่วย</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500">รวม</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500">SKU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doc.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                    ไม่มีรายการสินค้า
                  </td>
                </tr>
              ) : (
                doc.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 tabular-nums text-gray-400">{item.lineNo ?? "—"}</td>
                    <td className="px-3 py-2">{item.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.quantity != null ? fmtQty(item.quantity) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{item.unit ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.unitPrice != null ? fmt(item.unitPrice) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {item.total != null ? fmt(item.total) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                      {item.product?.skuCode ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value}</dd>
    </div>
  )
}

function DocTypeBadge({ docType }: { docType: string }) {
  if (docType === "tax_invoice")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">TAX Invoice</span>
  if (docType === "abb_invoice")
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Abb Invoice</span>
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Quotation</span>
}

function PaymentBadge({ status }: { status: string | null }) {
  if (status === "paid")
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">ชำระแล้ว</span>
  return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">รอชำระ</span>
}
```

- [ ] **Step 2: Navigate to a known document in dev and verify**

```bash
npm run dev
```

Go to `http://localhost:3000/crm/documents` → click any document number once links are added (after Task 4). Or navigate directly: `http://localhost:3000/crm/documents/1` (replace 1 with a real ID from DB).

Verify:
- Left card shows doc number, type badge, date, customer link, salesperson, channel, payment badge, subtotal/vat/total, notes (if any)
- Right table shows line items with #, description, qty, unit, unit price, total, SKU
- "← เอกสาร" link goes back to `/crm/documents`
- Customer name is a clickable link to customer detail

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all 33 existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/documents/[id]/page.tsx
git commit -m "feat: document detail page with two-column layout and line items"
```

---

## Task 4: Link Documents List → Document Detail

**Files:**
- Modify: `src/app/crm/documents/page.tsx`

### Context

Currently the `docNumber` cell renders:
```tsx
<td className="px-4 py-3 font-mono text-xs">{d.docNumber}</td>
```

- [ ] **Step 1: Wrap docNumber in a Link**

Replace the static `<td>` for docNumber (line ~170 in current file):

```tsx
<td className="px-4 py-3 font-mono text-xs">
  <Link
    href={`/crm/documents/${d.id}`}
    className="text-blue-600 hover:underline"
  >
    {d.docNumber}
  </Link>
</td>
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/crm/documents`. Confirm document numbers are now blue links. Click one → lands on detail page.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/documents/page.tsx
git commit -m "feat: link document numbers to detail page from documents list"
```

---

## Task 5: Link Customer Detail → Document Detail

**Files:**
- Modify: `src/app/crm/customers/[id]/page.tsx`

### Context

In the customer detail documents table, the docNumber cell currently renders:
```tsx
<td className="px-4 py-3 font-mono text-xs">{d.docNumber}</td>
```

This is inside the `.map((d) => ...)` over `customer.documents`.

- [ ] **Step 1: Wrap docNumber in a Link**

Replace that `<td>` (around line 102 in current file):

```tsx
<td className="px-4 py-3 font-mono text-xs">
  <Link
    href={`/crm/documents/${d.id}`}
    className="text-blue-600 hover:underline"
  >
    {d.docNumber}
  </Link>
</td>
```

`Link` is already imported at the top of this file.

- [ ] **Step 2: Verify in browser**

Go to any customer detail page. Confirm document numbers are links. Click one → lands on document detail.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/customers/[id]/page.tsx
git commit -m "feat: link document numbers to detail page from customer detail"
```
