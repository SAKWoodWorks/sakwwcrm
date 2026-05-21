# Payment Toggle, Salesperson Detail & Top Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payment status toggling on document views, a salesperson performance detail page, and a top-10 customers table on the dashboard.

**Architecture:** New PATCH API route for payment updates (with auth); shared `PaymentToggle` client component reused in both list and detail; new server-component salesperson detail page; dashboard extended with a second parallel query. No schema changes.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, Tailwind CSS, TypeScript, Vitest, NextAuth v5

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/documents/[id]/payment/route.ts` | Create | PATCH endpoint to update paymentStatus |
| `src/__tests__/document-payment.test.ts` | Create | Tests for the PATCH route |
| `src/app/crm/documents/PaymentToggle.tsx` | Create | "use client" toggle button + badge |
| `src/app/crm/documents/[id]/page.tsx` | Modify | Replace PaymentBadge with PaymentToggle |
| `src/app/crm/documents/page.tsx` | Modify | Replace status cell with PaymentToggle |
| `src/app/crm/salespersons/[id]/page.tsx` | Create | Salesperson performance detail page |
| `src/app/crm/salespersons/page.tsx` | Modify | Link salesperson names to detail page |
| `src/app/crm/dashboard/page.tsx` | Modify | Add top-10 customers table |

---

## Task 1: Payment Status API Route

**Files:**
- Create: `src/app/api/documents/[id]/payment/route.ts`
- Test: `src/__tests__/document-payment.test.ts`

### Context

Existing API routes are in `src/app/api/`. The `auth()` function from `@/auth` returns the session object or `null`. Prisma client is imported from `@/lib/prisma`. Route params in Next.js 15 are a `Promise`.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/document-payment.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { PATCH } from "@/app/api/documents/[id]/payment/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/documents/1/payment", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/documents/[id]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    const res = await PATCH(makeRequest({ status: "invalid" }), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("updates to paid and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("5"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "paid" })
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { paymentStatus: "paid" },
    })
  })

  it("updates to pending and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    const res = await PATCH(makeRequest({ status: "pending" }), makeParams("3"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "pending" })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:\Works\Web\crm\new-crm && npx vitest run src/__tests__/document-payment.test.ts
```

Expected: FAIL with "Cannot find module" or similar — route does not exist yet.

- [ ] **Step 3: Create the route**

Create `src/app/api/documents/[id]/payment/route.ts`:

```ts
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const status = body?.status
  if (status !== "paid" && status !== "pending") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  await prisma.document.update({
    where: { id: docId },
    data: { paymentStatus: status },
  })

  return NextResponse.json({ ok: true, status })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/document-payment.test.ts
```

Expected: 5/5 PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass (33 existing + 5 new = 38 total)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/documents/[id]/payment/route.ts src/__tests__/document-payment.test.ts
git commit -m "feat: PATCH /api/documents/[id]/payment route with auth"
```

---

## Task 2: PaymentToggle Client Component

**Files:**
- Create: `src/app/crm/documents/PaymentToggle.tsx`

### Context

This is a `"use client"` component. It renders a status badge + toggle button. On click it calls the PATCH route from Task 1, then calls `router.refresh()` to re-render the parent server component with fresh data.

- [ ] **Step 1: Create the component**

Create `src/app/crm/documents/PaymentToggle.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function PaymentToggle({
  documentId,
  currentStatus,
}: {
  documentId: number
  currentStatus: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPaid = currentStatus === "paid"

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPaid ? "pending" : "paid" }),
      })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isPaid ? (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          ชำระแล้ว
        </span>
      ) : (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          รอชำระ
        </span>
      )}
      <button
        onClick={toggle}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 underline-offset-2 hover:underline"
      >
        {loading ? "..." : isPaid ? "ยกเลิก" : "ทำเครื่องหมายชำระแล้ว"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Run tests (no regressions)**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/documents/PaymentToggle.tsx
git commit -m "feat: PaymentToggle client component for payment status"
```

---

## Task 3: PaymentToggle in Document Detail Page

**Files:**
- Modify: `src/app/crm/documents/[id]/page.tsx`

### Context

The detail page's info card currently has a `PaymentBadge` component (local function at the bottom of the file). Replace the status `<div>` block with `PaymentToggle`. Also remove the local `PaymentBadge` function since it's no longer used in this file.

Current status block in the info card (inside the `<dl>`):
```tsx
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
```

- [ ] **Step 1: Add import and replace status block**

Add import at top of `src/app/crm/documents/[id]/page.tsx` (after existing imports):

```tsx
import PaymentToggle from "../PaymentToggle"
```

Replace the status `<div>` block with:

```tsx
<div>
  <dt className="font-medium text-gray-500">สถานะ</dt>
  <dd className="mt-0.5">
    {doc.docType === "tax_invoice" ? (
      <PaymentToggle documentId={doc.id} currentStatus={doc.paymentStatus} />
    ) : (
      <span className="text-gray-400">—</span>
    )}
  </dd>
</div>
```

Remove the local `PaymentBadge` function definition at the bottom of the file (the one that takes `status: string | null`). It is no longer used.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/documents/[id]/page.tsx
git commit -m "feat: payment toggle in document detail page"
```

---

## Task 4: PaymentToggle in Documents List

**Files:**
- Modify: `src/app/crm/documents/page.tsx`

### Context

The documents list is a server component but can import client components. The status cell currently has inline `<span>` badges. Replace with `PaymentToggle` for `tax_invoice` rows.

Current status cell in the table body (inside `documents.map`):
```tsx
<td className="px-4 py-3">
  {d.docType === "tax_invoice" && d.paymentStatus === "paid" ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      ชำระแล้ว
    </span>
  ) : d.docType === "tax_invoice" ? (
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
      รอชำระ
    </span>
  ) : (
    <span className="text-gray-400">—</span>
  )}
</td>
```

- [ ] **Step 1: Add import and replace status cell**

Add import at top of `src/app/crm/documents/page.tsx` (after existing imports):

```tsx
import PaymentToggle from "./PaymentToggle"
```

Replace the status `<td>` with:

```tsx
<td className="px-4 py-3">
  {d.docType === "tax_invoice" ? (
    <PaymentToggle documentId={d.id} currentStatus={d.paymentStatus} />
  ) : (
    <span className="text-gray-400">—</span>
  )}
</td>
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/documents/page.tsx
git commit -m "feat: payment toggle in documents list"
```

---

## Task 5: Salesperson Detail Page

**Files:**
- Create: `src/app/crm/salespersons/[id]/page.tsx`

### Context

The salespersons list page is at `src/app/crm/salespersons/page.tsx`. The new detail page follows the same patterns as `customers/[id]/page.tsx` and `documents/[id]/page.tsx`. Three parallel queries: KPIs, customer list, recent documents.

`Salesperson` schema fields: `id`, `name`, `lineUserId`, `channel`, `active`.

`BigInt` columns from `$queryRaw` must be wrapped with `Number()`. `Decimal` columns with `Number()` before formatting.

- [ ] **Step 1: Create the detail page**

Create `src/app/crm/salespersons/[id]/page.tsx`:

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DocTypeBadge } from "@/app/crm/documents/DocTypeBadge"

type Props = {
  params: Promise<{ id: string }>
}

interface SpStats {
  id: number
  name: string
  line_user_id: string | null
  channel: string | null
  customer_count: bigint
  total_revenue: Prisma.Decimal
  monthly_revenue: Prisma.Decimal
  lapsed_count: bigint
}

interface CustomerRow {
  id: number
  name: string
  last_purchase_date: Date | null
  last_purchase_total: Prisma.Decimal | null
}

export default async function SalespersonDetailPage({ params }: Props) {
  const { id } = await params
  const spId = parseInt(id)
  if (isNaN(spId)) notFound()

  const [statsRows, customers, documents] = await Promise.all([
    prisma.$queryRaw<SpStats[]>`
      SELECT
        s.id,
        s.name,
        s.line_user_id,
        s.channel,
        COUNT(DISTINCT c.id)                                                              AS customer_count,
        COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0)               AS total_revenue,
        COALESCE(SUM(d.total) FILTER (
          WHERE d.doc_type = 'tax_invoice'
          AND d.doc_date >= date_trunc('month', CURRENT_DATE)
        ), 0)                                                                             AS monthly_revenue,
        (
          SELECT COUNT(DISTINCT c2.id)
          FROM customers c2
          JOIN documents di ON di.customer_id = c2.id AND di.salesperson_id = s.id AND di.doc_type = 'tax_invoice'
          WHERE NOT EXISTS (
            SELECT 1 FROM documents di2
            WHERE di2.customer_id = c2.id
              AND di2.doc_type = 'tax_invoice'
              AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
          )
        )                                                                                 AS lapsed_count
      FROM salespersons s
      LEFT JOIN documents d ON d.salesperson_id = s.id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE s.id = ${spId}
      GROUP BY s.id, s.name, s.line_user_id, s.channel
    `,
    prisma.$queryRaw<CustomerRow[]>`
      SELECT
        c.id,
        c.name,
        last_inv.doc_date  AS last_purchase_date,
        last_inv.total     AS last_purchase_total
      FROM customers c
      JOIN documents d ON d.customer_id = c.id AND d.salesperson_id = ${spId} AND d.doc_type = 'tax_invoice'
      LEFT JOIN LATERAL (
        SELECT doc_date, total
        FROM documents
        WHERE customer_id = c.id AND doc_type = 'tax_invoice'
        ORDER BY doc_date DESC
        LIMIT 1
      ) last_inv ON TRUE
      GROUP BY c.id, c.name, last_inv.doc_date, last_inv.total
      ORDER BY last_inv.doc_date DESC NULLS LAST
      LIMIT 50
    `,
    prisma.document.findMany({
      where: { salespersonId: spId },
      orderBy: { docDate: "desc" },
      take: 20,
      select: {
        id: true,
        docNumber: true,
        docDate: true,
        docType: true,
        total: true,
        paymentStatus: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ])

  if (statsRows.length === 0) notFound()
  const sp = statsRows[0]

  const fmt = (n: unknown) =>
    Number(n).toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    })

  const kpis = [
    { label: "ลูกค้า", value: Number(sp.customer_count).toLocaleString("th-TH") },
    { label: "ยอดรวม", value: fmt(sp.total_revenue) },
    { label: "เดือนนี้", value: fmt(sp.monthly_revenue) },
    {
      label: "Lapsed >90 วัน",
      value: Number(sp.lapsed_count).toLocaleString("th-TH"),
      red: Number(sp.lapsed_count) > 0,
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/crm/salespersons" className="text-sm text-blue-600 hover:underline">
          ← พนักงานขาย
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{sp.name}</h1>
        {sp.line_user_id ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            ✅ LINE ลงทะเบียนแล้ว
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            ยังไม่ลงทะเบียน LINE
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${k.red ? "text-red-600" : "text-gray-800"}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Customers table */}
      <h2 className="mb-3 text-lg font-semibold">ลูกค้า ({customers.length} รายการ)</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ซื้อล่าสุด</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  ไม่มีลูกค้า
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {c.last_purchase_date
                      ? c.last_purchase_date.toLocaleDateString("th-TH")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.last_purchase_total != null ? fmt(c.last_purchase_total) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent documents table */}
      <h2 className="mb-3 text-lg font-semibold">เอกสารล่าสุด ({documents.length} รายการ)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">วันที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เลขที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/crm/documents/${d.id}`} className="text-blue-600 hover:underline">
                    {d.docNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {d.customer ? (
                    <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                      {d.customer.name}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <DocTypeBadge docType={d.docType} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.total != null ? fmt(d.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Note on import path:** `DocTypeBadge` is at `src/app/crm/documents/DocTypeBadge.tsx`. From `src/app/crm/salespersons/[id]/page.tsx` the relative path is `../../documents/DocTypeBadge`. Use that, or use the `@/` alias: `import { DocTypeBadge } from "@/app/crm/documents/DocTypeBadge"`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/salespersons/[id]/page.tsx
git commit -m "feat: salesperson detail page with KPIs, customers and recent documents"
```

---

## Task 6: Link Salesperson Names in List

**Files:**
- Modify: `src/app/crm/salespersons/page.tsx`

### Context

The salespersons list renders each row in a `rows.map`. The name cell currently shows plain text. Add `Link` import and wrap the name.

Current name cell (around line 65):
```tsx
<td className="px-4 py-3 font-medium">{row.name}</td>
```

- [ ] **Step 1: Add import and wrap name**

Add `import Link from "next/link"` at the top of `src/app/crm/salespersons/page.tsx` (after existing imports).

Replace the name cell:

```tsx
<td className="px-4 py-3 font-medium">
  <Link href={`/crm/salespersons/${row.id}`} className="text-blue-600 hover:underline">
    {row.name}
  </Link>
</td>
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/salespersons/page.tsx
git commit -m "feat: link salesperson names to detail page"
```

---

## Task 7: Top Customers on Dashboard

**Files:**
- Modify: `src/app/crm/dashboard/page.tsx`

### Context

The dashboard currently runs one `$queryRaw` for stats and renders 4 KPI cards. Add a second parallel query for top-10 customers and render a table below the cards.

`Prisma.Decimal` columns must be wrapped with `Number()`. `Link` is not yet imported in this file.

- [ ] **Step 1: Add interface and top customers query**

In `src/app/crm/dashboard/page.tsx`:

Add `import Link from "next/link"` after existing imports.

Add interface after the existing `Stats` interface:

```ts
interface TopCustomer {
  id: number
  name: string
  lifetime_total: Prisma.Decimal
  last_purchase_date: Date
}
```

Change the single `$queryRaw` call into a `Promise.all` that runs both queries in parallel:

```ts
const [[stats], topCustomers] = await Promise.all([
  prisma.$queryRaw<Stats[]>`
    SELECT
      (SELECT COUNT(*) FROM customers)                                           AS total_customers,
      (SELECT COALESCE(SUM(total), 0)
       FROM documents
       WHERE doc_type = 'tax_invoice'
         AND doc_date >= date_trunc('month', CURRENT_DATE))                     AS monthly_revenue,
      (SELECT COUNT(*)
       FROM documents
       WHERE doc_type = 'tax_invoice'
         AND doc_date >= date_trunc('month', CURRENT_DATE))                     AS monthly_invoices,
      (SELECT COUNT(DISTINCT customer_id)
       FROM documents
       WHERE doc_type = 'tax_invoice'
         AND customer_id IS NOT NULL
         AND customer_id NOT IN (
           SELECT DISTINCT customer_id
           FROM documents
           WHERE doc_type = 'tax_invoice'
             AND doc_date >= CURRENT_DATE - INTERVAL '90 days'
             AND customer_id IS NOT NULL
         ))                                                                     AS lapsed_count
  `,
  prisma.$queryRaw<TopCustomer[]>`
    SELECT
      c.id,
      c.name,
      COALESCE(SUM(d.total), 0) AS lifetime_total,
      MAX(d.doc_date)           AS last_purchase_date
    FROM customers c
    JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
    GROUP BY c.id, c.name
    ORDER BY lifetime_total DESC
    LIMIT 10
  `,
])
```

- [ ] **Step 2: Add top customers table to JSX**

Below the existing `</div>` that closes the 4-card grid, add:

```tsx
{/* Top customers */}
<h2 className="mb-3 mt-8 text-lg font-semibold">Top 10 ลูกค้า (ยอดซื้อรวม)</h2>
<div className="overflow-x-auto rounded-lg border border-gray-200">
  <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
        <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
        <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดรวม</th>
        <th className="px-4 py-3 text-left font-medium text-gray-500">ซื้อล่าสุด</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {topCustomers.map((c, i) => (
        <tr key={c.id} className="hover:bg-gray-50">
          <td className="px-4 py-3 tabular-nums text-gray-400">{i + 1}</td>
          <td className="px-4 py-3">
            <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
              {c.name}
            </Link>
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-medium">
            {Number(c.lifetime_total).toLocaleString("th-TH", {
              style: "currency",
              currency: "THB",
              minimumFractionDigits: 0,
            })}
          </td>
          <td className="px-4 py-3 tabular-nums text-gray-600">
            {c.last_purchase_date
              ? new Date(c.last_purchase_date).toLocaleDateString("th-TH")
              : "—"}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/dashboard/page.tsx
git commit -m "feat: top 10 customers table on dashboard"
```
