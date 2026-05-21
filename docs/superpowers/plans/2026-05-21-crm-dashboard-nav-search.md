# CRM Dashboard, Navigation, Search & Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard with 4 KPI cards, active-state nav highlighting, sortable customer list, and customer-name search + payment-status filter + sort on the documents page.

**Architecture:** NavBar extracted to a `"use client"` component using `usePathname`. Dashboard is a new server page with one `$queryRaw` for all stats. Customers page switches from `findMany` to `$queryRaw` to enable sorting by computed last-purchase date. Documents page extends existing Prisma `findMany` with `q`/`status`/`sort`/`order` search params.

**Tech Stack:** Next.js App Router, Tailwind CSS, Prisma Client (`$queryRaw`, `findMany`, `Prisma.sql`), `usePathname`, `useSearchParams`, `useRouter`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/NavBar.tsx` | Create | Client component, active-state nav links |
| `src/app/layout.tsx` | Modify | Replace inline nav with `<NavBar />` |
| `src/app/crm/page.tsx` | Modify | Redirect to `/crm/dashboard` |
| `src/app/crm/dashboard/page.tsx` | Create | 4 KPI stat cards |
| `src/app/crm/customers/page.tsx` | Modify | `$queryRaw` + sort params + sortable headers |
| `src/app/crm/documents/page.tsx` | Modify | `q`/`status`/`sort`/`order` params + sort headers |
| `src/app/crm/documents/DocumentFilters.tsx` | Modify | Add customer-name input, payment-status select, abb_invoice option |

---

### Task 1: NavBar client component with active-state highlighting

**Files:**
- Create: `src/components/NavBar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/NavBar.tsx`**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/crm/dashboard", label: "Dashboard" },
  { href: "/crm/customers", label: "ลูกค้า" },
  { href: "/crm/documents", label: "เอกสาร" },
  { href: "/crm/products", label: "สินค้า" },
  { href: "/crm/salespersons", label: "พนักงาน" },
]

export default function NavBar() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-800">CRM</span>
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? "text-sm font-semibold text-blue-600"
                  : "text-sm text-gray-600 hover:text-blue-600"
              }
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Replace inline nav in `src/app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import NavBar from "@/components/NavBar"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CRM",
  description: "Sales CRM",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={geist.className}>
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors. Fix any before continuing.

- [ ] **Step 4: Manual verify**

Run `npm run dev`, open `http://localhost:3000/crm/customers`. The "ลูกค้า" nav link should appear bold/blue. Navigate to `/crm/documents` — "เอกสาร" turns blue, "ลูกค้า" returns to gray.

- [ ] **Step 5: Commit**

```bash
git add src/components/NavBar.tsx src/app/layout.tsx
git commit -m "feat: NavBar client component with active-state highlighting"
```

---

### Task 2: Dashboard page with 4 KPI cards

**Files:**
- Create: `src/app/crm/dashboard/page.tsx`
- Modify: `src/app/crm/page.tsx`

- [ ] **Step 1: Update redirect in `src/app/crm/page.tsx`**

Replace file contents with:

```tsx
import { redirect } from "next/navigation"

export default function CrmIndex() {
  redirect("/crm/dashboard")
}
```

- [ ] **Step 2: Create `src/app/crm/dashboard/page.tsx`**

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"

interface Stats {
  total_customers: bigint
  monthly_revenue: Prisma.Decimal
  monthly_invoices: bigint
  lapsed_count: bigint
}

export default async function DashboardPage() {
  const [stats] = await prisma.$queryRaw<Stats[]>`
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
  `

  const cards = [
    {
      label: "ลูกค้าทั้งหมด",
      value: Number(stats.total_customers).toLocaleString("th-TH"),
      href: "/crm/customers",
      color: "text-blue-700",
      border: "border-blue-100",
    },
    {
      label: "ยอดขายเดือนนี้",
      value: Number(stats.monthly_revenue).toLocaleString("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 0,
      }),
      href: null,
      color: "text-green-700",
      border: "border-green-100",
    },
    {
      label: "Invoice เดือนนี้",
      value: Number(stats.monthly_invoices).toLocaleString("th-TH"),
      href: "/crm/documents?type=tax_invoice",
      color: "text-gray-800",
      border: "border-gray-100",
    },
    {
      label: "Lapsed >90 วัน",
      value: Number(stats.lapsed_count).toLocaleString("th-TH"),
      href: "/crm/customers",
      color: "text-red-600",
      border: "border-red-100",
    },
  ]

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => {
          const inner = (
            <div
              className={`rounded-lg border ${card.border} bg-white p-5 ${card.href ? "hover:shadow-md transition-shadow" : ""}`}
            >
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </div>
          )
          return card.href ? (
            <Link key={card.label} href={card.href}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no errors. If Prisma complains about BigInt in JSON serialization, wrap with `Number()` (already done above).

- [ ] **Step 4: Manual verify**

`npm run dev`, open `http://localhost:3000/crm/dashboard`. Four cards visible with real numbers. Clicking "ลูกค้าทั้งหมด" navigates to customers. Clicking "Invoice เดือนนี้" navigates to documents filtered by tax_invoice.

- [ ] **Step 5: Commit**

```bash
git add src/app/crm/page.tsx src/app/crm/dashboard/page.tsx
git commit -m "feat: dashboard page with 4 KPI cards"
```

---

### Task 3: Customers page — sort by last purchase, name, or last total

**Files:**
- Modify: `src/app/crm/customers/page.tsx`

The existing `findMany` can't sort by a relation's max value, so switch to `$queryRaw`. `CustomerSearch.tsx` is unchanged — it already preserves all search params via `useSearchParams().toString()`.

- [ ] **Step 1: Replace `src/app/crm/customers/page.tsx`**

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { Suspense } from "react"
import CustomerSearch from "./CustomerSearch"

interface CustomerRow {
  id: number
  name: string
  tax_id: string | null
  province: string | null
  type: string | null
  status: string
  salesperson_name: string | null
  last_purchase_date: Date | null
  last_purchase_total: Prisma.Decimal | number | null
}

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string }>
}

const PAGE_SIZE = 50

const SORT_CLAUSES: Record<string, Prisma.Sql> = {
  "last_purchase:asc":  Prisma.sql`last_purchase_date ASC NULLS LAST`,
  "last_purchase:desc": Prisma.sql`last_purchase_date DESC NULLS LAST`,
  "name:asc":           Prisma.sql`c.name ASC`,
  "name:desc":          Prisma.sql`c.name DESC`,
  "last_total:asc":     Prisma.sql`last_purchase_total ASC NULLS LAST`,
  "last_total:desc":    Prisma.sql`last_purchase_total DESC NULLS LAST`,
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q, page: pageStr, sort = "last_purchase", order = "desc" } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const searchFilter = q
    ? Prisma.sql`(c.name ILIKE ${`%${q}%`} OR c.tax_id ILIKE ${`%${q}%`})`
    : Prisma.sql`TRUE`

  const orderBy =
    SORT_CLAUSES[`${sort}:${order}`] ?? Prisma.sql`last_purchase_date DESC NULLS LAST`

  const [customers, countResult] = await Promise.all([
    prisma.$queryRaw<CustomerRow[]>`
      SELECT
        c.id,
        c.name,
        c.tax_id,
        c.province,
        c.type,
        c.status,
        s.name AS salesperson_name,
        MAX(CASE WHEN d.doc_type = 'tax_invoice' THEN d.doc_date END) AS last_purchase_date,
        MAX(CASE WHEN d.doc_type = 'tax_invoice' THEN d.total END)    AS last_purchase_total
      FROM customers c
      LEFT JOIN salespersons s ON s.id = c.salesperson_id
      LEFT JOIN documents d ON d.customer_id = c.id
      WHERE ${searchFilter}
      GROUP BY c.id, c.name, c.tax_id, c.province, c.type, c.status, s.name
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${skip}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM customers c WHERE ${searchFilter}
    `,
  ])

  const total = Number(countResult[0].count)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function sortUrl(sortKey: string) {
    const newOrder = sort === sortKey && order === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("sort", sortKey)
    params.set("order", newOrder)
    return `/crm/customers?${params}`
  }

  function indicator(sortKey: string) {
    if (sort !== sortKey) return null
    return order === "desc" ? " ↓" : " ↑"
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ลูกค้า</h1>
        <Suspense>
          <CustomerSearch />
        </Suspense>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                <Link href={sortUrl("name")} className="hover:text-gray-800">
                  ชื่อ{indicator("name")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">TAX ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">จังหวัด</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">สถานะ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                <Link href={sortUrl("last_purchase")} className="hover:text-gray-800">
                  ซื้อล่าสุด{indicator("last_purchase")}
                </Link>
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                <Link href={sortUrl("last_total")} className="hover:text-gray-800">
                  ยอดล่าสุด{indicator("last_total")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">PM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/crm/customers/${c.id}`} className="font-medium text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.tax_id ?? "—"}</td>
                <td className="px-4 py-3">{c.province ?? "—"}</td>
                <td className="px-4 py-3"><TypeBadge type={c.type} /></td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-gray-600">
                  {c.last_purchase_date
                    ? new Date(c.last_purchase_date).toLocaleDateString("th-TH")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.last_purchase_total
                    ? Number(c.last_purchase_total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.salesperson_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0
            ? "ไม่พบรายการ"
            : `แสดง ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} จาก ${total} รายการ`}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, page: String(page - 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, page: String(page + 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ถัดไป →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, string> = {
    retail: "bg-green-100 text-green-800",
    dealer: "bg-blue-100 text-blue-800",
    lazada: "bg-orange-100 text-orange-800",
    thai_watsadu: "bg-purple-100 text-purple-800",
  }
  const cls = (type && map[type]) ?? "bg-gray-100 text-gray-800"
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type ?? "ไม่ระบุ"}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    not_purchase_yet: "bg-gray-100 text-gray-600",
    active: "bg-yellow-100 text-yellow-800",
    repeat: "bg-green-100 text-green-800",
    purchased: "bg-green-100 text-green-800",
  }
  const label: Record<string, string> = {
    not_purchase_yet: "ยังไม่ซื้อ",
    active: "Active",
    repeat: "Repeat",
    purchased: "ซื้อแล้ว",
  }
  const cls = map[status] ?? "bg-gray-100 text-gray-600"
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no errors. If you see `Prisma.sql` import issues, ensure `import { Prisma } from "@prisma/client"` is at the top.

- [ ] **Step 3: Manual verify**

`npm run dev`, open `/crm/customers`. Click "ซื้อล่าสุด" header — URL gets `?sort=last_purchase&order=asc`, list re-sorts. Click again — flips to `desc`. Search for a name, then click sort — `q` param preserved. Pagination arrows keep sort params.

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/customers/page.tsx
git commit -m "feat: sortable customers list via \$queryRaw"
```

---

### Task 4: Documents page — customer search, payment status filter, sort

**Files:**
- Modify: `src/app/crm/documents/DocumentFilters.tsx`
- Modify: `src/app/crm/documents/page.tsx`

- [ ] **Step 1: Update `src/app/crm/documents/DocumentFilters.tsx`**

Add customer name input, payment_status select, abb_invoice option. Replace file:

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

type Props = {
  salespersons: { id: number; name: string }[]
}

export default function DocumentFilters({ salespersons }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nameValue, setNameValue] = useState(searchParams.get("q") ?? "")

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`/crm/documents?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="ค้นหาชื่อลูกค้า..."
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && update("q", nameValue)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกประเภท</option>
        <option value="tax_invoice">TAX Invoice</option>
        <option value="quotation">Quotation</option>
        <option value="abb_invoice">Abb Invoice</option>
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกสถานะ</option>
        <option value="paid">ชำระแล้ว</option>
        <option value="pending">รอชำระ</option>
      </select>

      <select
        value={searchParams.get("channel") ?? ""}
        onChange={(e) => update("channel", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกช่องทาง</option>
        <option value="Web">Web</option>
        <option value="Incall099">Incall099</option>
      </select>

      <select
        value={searchParams.get("salesperson") ?? ""}
        onChange={(e) => update("salesperson", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกพนักงาน</option>
        {salespersons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => update("from", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />

      <input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => update("to", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/crm/documents/page.tsx`**

Replace file:

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Suspense } from "react"
import DocumentFilters from "./DocumentFilters"
import type { Prisma } from "@prisma/client"

type Props = {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    channel?: string
    salesperson?: string
    from?: string
    to?: string
    sort?: string
    order?: string
    page?: string
  }>
}

const PAGE_SIZE = 50

export default async function DocumentsPage({ searchParams }: Props) {
  const {
    q,
    type,
    status,
    channel,
    salesperson,
    from,
    to,
    sort = "docDate",
    order = "desc",
    page: pageStr,
  } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.DocumentWhereInput = {}
  if (type) where.docType = type
  if (status) where.paymentStatus = status
  if (channel) where.channel = channel
  if (salesperson) {
    const sid = parseInt(salesperson)
    if (!isNaN(sid)) where.salespersonId = sid
  }
  if (from || to) {
    where.docDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }
  if (q) {
    where.customer = { name: { contains: q, mode: "insensitive" } }
  }

  const validSorts = ["docDate", "total"] as const
  type SortField = (typeof validSorts)[number]
  const sortField: SortField = validSorts.includes(sort as SortField)
    ? (sort as SortField)
    : "docDate"
  const sortOrder = order === "asc" ? "asc" : "desc"

  const [documents, total, salespersons] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        docType: true,
        docNumber: true,
        docDate: true,
        channel: true,
        paymentStatus: true,
        total: true,
        customer: { select: { id: true, name: true } },
        salesperson: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildPageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (channel) params.set("channel", channel)
    if (salesperson) params.set("salesperson", salesperson)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("sort", sortField)
    params.set("order", sortOrder)
    params.set("page", String(p))
    return `/crm/documents?${params.toString()}`
  }

  function sortUrl(sortKey: string) {
    const newOrder = sortField === sortKey && sortOrder === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (channel) params.set("channel", channel)
    if (salesperson) params.set("salesperson", salesperson)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("sort", sortKey)
    params.set("order", newOrder)
    return `/crm/documents?${params}`
  }

  function indicator(sortKey: string) {
    if (sortField !== sortKey) return null
    return sortOrder === "desc" ? " ↓" : " ↑"
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">เอกสาร</h1>
      </div>

      <div className="mb-4">
        <Suspense>
          <DocumentFilters salespersons={salespersons} />
        </Suspense>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                <Link href={sortUrl("docDate")} className="hover:text-gray-800">
                  วันที่{indicator("docDate")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เลขที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ช่องทาง</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">พนักงาน</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                <Link href={sortUrl("total")} className="hover:text-gray-800">
                  ยอด{indicator("total")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{d.docNumber}</td>
                <td className="px-4 py-3">
                  <DocTypeBadge docType={d.docType} />
                </td>
                <td className="px-4 py-3">
                  {d.customer ? (
                    <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                      {d.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</td>
                <td className="px-4 py-3">{d.salesperson?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.total
                    ? Number(d.total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0
            ? "ไม่พบรายการ"
            : `แสดง ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} จาก ${total} รายการ`}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ถัดไป →
            </Link>
          )}
        </div>
      </div>
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
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Manual verify**

`npm run dev`, open `/crm/documents`.
- Type a customer name in the search box, press Enter — list filters.
- Select "ชำระแล้ว" in สถานะ dropdown — only paid invoices show.
- Select "Abb Invoice" from ประเภท dropdown — abb_invoice rows show.
- Click "วันที่" header — sorts ascending, ↑ appears. Click again — descending.
- Click "ยอด" header — sorts by total.
- Pagination preserves all filter and sort params.

- [ ] **Step 5: Final build + tests**

```bash
npm run build
npm test
```

Expected: build passes, all existing tests pass (no changes to API routes).

- [ ] **Step 6: Commit**

```bash
git add src/app/crm/documents/page.tsx src/app/crm/documents/DocumentFilters.tsx
git commit -m "feat: documents customer search, payment status filter, sort"
```

---

### Final: push to server

```bash
git push
```

On server:
```bash
cd /home/info/sakwwcrm/new-crm
git pull
sudo docker compose up -d --build
```
