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
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string; lapsed?: string }>
}

const LAPSED_OPTIONS = [
  { value: "30", label: "ไม่ซื้อ 30–59 วัน", min: 30, max: 59 },
  { value: "60", label: "ไม่ซื้อ 60–89 วัน", min: 60, max: 89 },
  { value: "90", label: "ไม่ซื้อ 90–364 วัน", min: 90, max: 364 },
  { value: "365", label: "ไม่ซื้อ >1 ปี", min: 365, max: null },
]

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
  const { q, page: pageStr, sort = "last_purchase", order = "desc", lapsed } = await searchParams
  const lapsedDays = lapsed && ["30", "60", "90", "365"].includes(lapsed) ? parseInt(lapsed) : null
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const searchFilter = q
    ? Prisma.sql`(c.name ILIKE ${`%${q}%`} OR c.tax_id ILIKE ${`%${q}%`})`
    : Prisma.sql`TRUE`

  const lapsedOpt = LAPSED_OPTIONS.find((o) => o.value === lapsed) ?? null
  const lapsedFilter = lapsedOpt
    ? lapsedOpt.max !== null
      ? Prisma.sql`AND last_inv.doc_date IS NOT NULL AND last_inv.doc_date < CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.min} AND last_inv.doc_date >= CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.max + 1}`
      : Prisma.sql`AND last_inv.doc_date IS NOT NULL AND last_inv.doc_date < CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.min}`
    : Prisma.sql``

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
        last_inv.doc_date AS last_purchase_date,
        last_inv.total    AS last_purchase_total
      FROM customers c
      LEFT JOIN salespersons s ON s.id = c.salesperson_id
      LEFT JOIN LATERAL (
        SELECT doc_date, total
        FROM documents
        WHERE customer_id = c.id AND doc_type = 'tax_invoice'
        ORDER BY doc_date DESC
        LIMIT 1
      ) last_inv ON TRUE
      WHERE ${searchFilter}
      ${lapsedFilter}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${skip}
    `,
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
  ])

  const total = Number(countResult[0].count)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function sortUrl(sortKey: string) {
    const newOrder = sort === sortKey && order === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("sort", sortKey)
    params.set("order", newOrder)
    if (lapsedDays) params.set("lapsed", String(lapsedDays))
    return `/crm/customers?${params.toString()}`
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

      <div className="mb-3 flex gap-2">
        {LAPSED_OPTIONS.map((opt) => {
          const isActive = lapsedDays === parseInt(opt.value)
          const baseParams = new URLSearchParams({ sort, order, ...(q ? { q } : {}) })
          if (!isActive) baseParams.set("lapsed", opt.value)
          return (
            <Link
              key={opt.value}
              href={`/crm/customers?${baseParams.toString()}`}
              className={
                isActive
                  ? "inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  : "inline-flex items-center rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              }
            >
              {opt.label}{isActive ? " ✕" : ""}
            </Link>
          )
        })}
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
                    ? c.last_purchase_date.toLocaleDateString("th-TH")
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
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), page: String(page - 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), page: String(page + 1) })}`}
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
