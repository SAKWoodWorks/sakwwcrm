# Salespersons Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/crm/salespersons` page listing real salespersons (those with ≥1 customer) with LINE status, customer count, total revenue, and lapsed customer count (>90 days).

**Architecture:** One new server component page (`page.tsx`) using a single `$queryRaw` SQL query. Nav link added to `layout.tsx`. Test file mocks `prisma.$queryRaw` and calls the async page function directly.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7 `$queryRaw`, Tailwind v4, Vitest + @testing-library/react.

---

## File Map

```
src/
├── app/
│   ├── layout.tsx                         MODIFY — add nav link "พนักงาน"
│   └── crm/
│       └── salespersons/
│           └── page.tsx                   CREATE — async server component
└── __tests__/
    └── salespersons-page.test.tsx         CREATE — unit tests
```

---

## Task 1: Write failing test

**Files:**
- Create: `src/__tests__/salespersons-page.test.tsx`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from "@/lib/prisma"
import SalespersonsPage from "@/app/crm/salespersons/page"

const mockRows = [
  {
    id: 8,
    name: "Pickachu",
    line_user_id: "U7e76ae55efbac1a1664fa49a3e877485",
    customer_count: BigInt(245),
    total_revenue: 1200000,
    lapsed_count: BigInt(12),
  },
  {
    id: 9,
    name: "Yaowalee",
    line_user_id: null,
    customer_count: BigInt(180),
    total_revenue: 890000,
    lapsed_count: BigInt(0),
  },
]

describe("SalespersonsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows)
  })

  it("renders salesperson names", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("Pickachu")).toBeInTheDocument()
    expect(screen.getByText("Yaowalee")).toBeInTheDocument()
  })

  it("shows LINE registered badge for registered salesperson", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("✅ ลงทะเบียนแล้ว")).toBeInTheDocument()
  })

  it("shows dash for unregistered salesperson LINE", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThan(0)
  })

  it("renders customer count and lapsed count", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("245")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd d:\Works\Web\crm\new-crm
npx vitest run src/__tests__/salespersons-page.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/crm/salespersons/page'`

---

## Task 2: Implement salespersons page

**Files:**
- Create: `src/app/crm/salespersons/page.tsx`

- [ ] **Step 3: Create page file**

```typescript
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

interface SalespersonRow {
  id: number
  name: string
  line_user_id: string | null
  customer_count: bigint
  total_revenue: Prisma.Decimal | number
  lapsed_count: bigint
}

export default async function SalespersonsPage() {
  const rows = await prisma.$queryRaw<SalespersonRow[]>`
    SELECT
      s.id,
      s.name,
      s.line_user_id,
      COUNT(DISTINCT c.id)                                                    AS customer_count,
      COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0)    AS total_revenue,
      (
        SELECT COUNT(DISTINCT c2.id)
        FROM customers c2
        WHERE c2.salesperson_id = s.id
          AND EXISTS (
            SELECT 1 FROM documents di
            WHERE di.customer_id = c2.id AND di.doc_type = 'tax_invoice'
          )
          AND NOT EXISTS (
            SELECT 1 FROM documents di2
            WHERE di2.customer_id = c2.id
              AND di2.doc_type = 'tax_invoice'
              AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
          )
      )                                                                       AS lapsed_count
    FROM salespersons s
    JOIN customers c ON c.salesperson_id = s.id
    LEFT JOIN documents d ON d.customer_id = c.id
    GROUP BY s.id, s.name, s.line_user_id
    ORDER BY
      (s.line_user_id IS NOT NULL) DESC,
      total_revenue DESC
  `

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">พนักงานขาย</h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">LINE</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดรวม</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">lapsed &gt;90 วัน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const lapsed = Number(row.lapsed_count)
              const revenue = Number(row.total_revenue)
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.line_user_id ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        ✅ ลงทะเบียนแล้ว
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(row.customer_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {revenue.toLocaleString("th-TH", {
                      style: "currency",
                      currency: "THB",
                      minimumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {lapsed > 0 ? (
                      <span className="font-medium text-red-600">{lapsed}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {rows.length} พนักงาน (แสดงเฉพาะที่มีลูกค้า)
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/__tests__/salespersons-page.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run full test suite — expect all pass**

```bash
npx vitest run
```

Expected: all 32 tests PASS.

---

## Task 3: Add nav link

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 6: Add nav link after "สินค้า"**

In `src/app/layout.tsx`, after the สินค้า `<Link>`:

```tsx
<Link
  href="/crm/salespersons"
  className="text-sm text-gray-600 hover:text-blue-600"
>
  พนักงาน
</Link>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/crm/salespersons/page.tsx src/__tests__/salespersons-page.test.tsx src/app/layout.tsx
git commit -m "feat: salespersons page with LINE status and lapsed count"
```
