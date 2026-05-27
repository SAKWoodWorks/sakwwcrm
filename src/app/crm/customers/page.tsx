export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { Suspense } from "react"
import CustomerSearch from "./CustomerSearch"
import { formatSalespersonName } from "@/lib/salesperson-display"

interface CustomerRow {
  id: number
  name: string
  tax_id: string | null
  province: string | null
  type: string | null
  status: string
  salesperson_name: string | null
  alias_names: string | null
  last_purchase_date: Date | null
  last_purchase_total: Prisma.Decimal | number | null
}

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string; lapsed?: string; purchase?: string }>
}

const LAPSED_OPTIONS = [
  { value: "30", label: "ไม่ซื้อ 30–59 วัน", min: 30, max: 59 },
  { value: "60", label: "ไม่ซื้อ 60–89 วัน", min: 60, max: 89 },
  { value: "90", label: "ไม่ซื้อ 90–364 วัน", min: 90, max: 364 },
  { value: "365", label: "ไม่ซื้อ >1 ปี", min: 365, max: null },
]

const PAGE_SIZE = 50

const PURCHASE_OPTIONS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "purchased", label: "ซื้อแล้ว" },
  { value: "not_purchased", label: "ยังไม่ได้ซื้อ" },
]

const SORT_CLAUSES: Record<string, Prisma.Sql> = {
  "last_purchase:asc":  Prisma.sql`last_purchase_date ASC NULLS LAST`,
  "last_purchase:desc": Prisma.sql`last_purchase_date DESC NULLS LAST`,
  "name:asc":           Prisma.sql`c.name ASC`,
  "name:desc":          Prisma.sql`c.name DESC`,
  "last_total:asc":     Prisma.sql`last_purchase_total ASC NULLS LAST`,
  "last_total:desc":    Prisma.sql`last_purchase_total DESC NULLS LAST`,
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q, page: pageStr, sort = "last_purchase", order = "desc", lapsed, purchase } = await searchParams
  const lapsedDays = lapsed && ["30", "60", "90", "365"].includes(lapsed) ? parseInt(lapsed) : null
  const purchaseStatus = purchase === "purchased" || purchase === "not_purchased" ? purchase : "all"
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const searchFilter = q
    ? Prisma.sql`(
        c.name ILIKE ${`%${q}%`}
        OR c.tax_id ILIKE ${`%${q}%`}
        OR EXISTS (
          SELECT 1
          FROM customer_aliases ca
          WHERE ca.customer_id = c.id
            AND (ca.alias_name ILIKE ${`%${q}%`} OR ca.tax_id ILIKE ${`%${q}%`})
        )
      )`
    : Prisma.sql`TRUE`

  const lapsedOpt = LAPSED_OPTIONS.find((o) => o.value === lapsed) ?? null
  const lapsedFilter = lapsedOpt
    ? lapsedOpt.max !== null
      ? Prisma.sql`AND last_inv.doc_date IS NOT NULL AND last_inv.doc_date < CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.min} AND last_inv.doc_date >= CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.max + 1}`
      : Prisma.sql`AND last_inv.doc_date IS NOT NULL AND last_inv.doc_date < CURRENT_DATE - INTERVAL '1 day' * ${lapsedOpt.min}`
    : Prisma.sql``
  const purchaseFilter =
    purchaseStatus === "purchased"
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM documents purchase_doc
          WHERE purchase_doc.customer_id = c.id
            AND purchase_doc.doc_type = 'tax_invoice'
        )`
      : purchaseStatus === "not_purchased"
        ? Prisma.sql`AND NOT EXISTS (
            SELECT 1 FROM documents purchase_doc
            WHERE purchase_doc.customer_id = c.id
              AND purchase_doc.doc_type = 'tax_invoice'
          )`
        : Prisma.sql``

  const orderBy =
    SORT_CLAUSES[`${sort}:${order}`] ?? Prisma.sql`last_purchase_total DESC NULLS LAST`

  const countNeedsLastInvoice = Boolean(lapsedOpt)
  const countQuery = countNeedsLastInvoice
    ? prisma.$queryRaw<[{ count: bigint }]>`
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
        ${purchaseFilter}
      `
    : prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) AS count
        FROM customers c
        WHERE ${searchFilter}
        ${purchaseFilter}
      `

  const [customers, countResult] = await Promise.all([
    prisma.$queryRaw<CustomerRow[]>`
      SELECT
        c.id,
        c.name,
        c.tax_id,
        c.province,
        c.type,
        CASE
          WHEN last_inv.doc_date IS NOT NULL AND c.status = 'not_purchase_yet' THEN 'active'
          ELSE c.status
        END AS status,
        COALESCE(s.name, doc_sp.name) AS salesperson_name,
        aliases.alias_names,
        last_inv.doc_date AS last_purchase_date,
        last_inv.total    AS last_purchase_total
      FROM customers c
      LEFT JOIN salespersons s ON s.id = c.salesperson_id
      LEFT JOIN LATERAL (
        SELECT string_agg(alias_name, ', ' ORDER BY alias_name) AS alias_names
        FROM customer_aliases
        WHERE customer_id = c.id
      ) aliases ON TRUE
      LEFT JOIN LATERAL (
        SELECT doc_date, total, salesperson_id
        FROM documents
        WHERE customer_id = c.id AND doc_type = 'tax_invoice'
        ORDER BY doc_date DESC
        LIMIT 1
      ) last_inv ON TRUE
      LEFT JOIN salespersons doc_sp ON doc_sp.id = last_inv.salesperson_id
      WHERE ${searchFilter}
      ${lapsedFilter}
      ${purchaseFilter}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${skip}
    `,
    countQuery,
  ])

  const total = Number(countResult[0].count)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentListUrl = customerListUrl()

  function sortUrl(sortKey: string) {
    const newOrder = sort === sortKey && order === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("sort", sortKey)
    params.set("order", newOrder)
    if (lapsedDays) params.set("lapsed", String(lapsedDays))
    if (purchaseStatus !== "all") params.set("purchase", purchaseStatus)
    return `/crm/customers?${params.toString()}`
  }

  function customerFilterUrl(nextPurchase: string) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("sort", sort)
    params.set("order", order)
    if (lapsedDays) params.set("lapsed", String(lapsedDays))
    if (nextPurchase !== "all") params.set("purchase", nextPurchase)
    return `/crm/customers?${params.toString()}`
  }

  function customerListUrl() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("sort", sort)
    params.set("order", order)
    if (lapsedDays) params.set("lapsed", String(lapsedDays))
    if (purchaseStatus !== "all") params.set("purchase", purchaseStatus)
    if (page > 1) params.set("page", String(page))
    return `/crm/customers?${params.toString()}`
  }

  function customerDetailUrl(id: number) {
    return `/crm/customers/${id}?${new URLSearchParams({ returnTo: currentListUrl }).toString()}`
  }

  function indicator(sortKey: string) {
    if (sort !== sortKey) return null
    return order === "desc" ? " ↓" : " ↑"
  }

  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">ลูกค้า</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Button asChild variant="outline" className="h-11 border-orange-200 bg-white font-semibold text-orange-700 hover:bg-orange-50">
            <Link href="/crm/customers/duplicates">เช็คลูกค้าซ้ำ</Link>
          </Button>
          <Suspense>
            <CustomerSearch />
          </Suspense>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PURCHASE_OPTIONS.map((opt) => {
          const isActive = purchaseStatus === opt.value
          return (
            <Badge
              key={opt.value}
              asChild
              variant="outline"
              className={
                isActive
                  ? "border-[var(--crm-brand)] bg-[var(--crm-brand)] px-3 py-1 text-white hover:bg-[var(--crm-brand-dark)]"
                  : "border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-50"
              }
            >
              <Link href={customerFilterUrl(isActive ? "all" : opt.value)}>
                {opt.label}{isActive && opt.value !== "all" ? " ✕" : ""}
              </Link>
            </Badge>
          )
        })}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {LAPSED_OPTIONS.map((opt) => {
          const isActive = lapsedDays === parseInt(opt.value)
          const baseParams = new URLSearchParams({
            sort,
            order,
            ...(q ? { q } : {}),
            ...(purchaseStatus !== "all" ? { purchase: purchaseStatus } : {}),
          })
          if (!isActive) baseParams.set("lapsed", opt.value)
          return (
            <Badge
              key={opt.value}
              asChild
              variant="outline"
              className={
                isActive
                  ? "border-red-600 bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                  : "border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
              }
            >
              <Link
                href={`/crm/customers?${baseParams.toString()}`}
              >
                {opt.label}{isActive ? " ✕" : ""}
              </Link>
            </Badge>
          )
        })}
      </div>

      <div className="crm-mobile-list">
        {customers.map((c) => (
          <Card key={c.id} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
            <Link href={customerDetailUrl(c.id)} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-base font-bold text-[var(--crm-ink)]">{c.name}</h2>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">{c.tax_id ?? "ไม่มี TAX ID"}</p>
                  {c.alias_names ? (
                    <p className="mt-1 truncate text-xs text-[var(--crm-muted)]" title={c.alias_names}>
                      ชื่อเดิม: {formatAliasSummary(c.alias_names)}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">จังหวัด</p>
                  <p className="font-medium">{c.province ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">ซื้อล่าสุด</p>
                  <p className="font-medium">{c.last_purchase_date ? c.last_purchase_date.toLocaleDateString("th-TH") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">ยอดล่าสุด</p>
                  <p className="font-medium tabular-nums">
                    {c.last_purchase_total
                      ? Number(c.last_purchase_total).toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">Salesperson</p>
                  <p className="font-medium">{formatSalespersonName(c.salesperson_name)}</p>
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">
                <Link href={sortUrl("name")} className="hover:text-gray-800">
                  ชื่อ{indicator("name")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">TAX ID</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">จังหวัด</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ประเภท</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">สถานะ</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">
                <Link href={sortUrl("last_purchase")} className="hover:text-gray-800">
                  ซื้อล่าสุด{indicator("last_purchase")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">
                <Link href={sortUrl("last_total")} className="hover:text-gray-800">
                  ยอดล่าสุด{indicator("last_total")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">Salesperson</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3">
                  <Link href={customerDetailUrl(c.id)} className="font-medium text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                  {c.alias_names ? (
                    <div className="mt-1 max-w-[24rem] truncate text-xs text-gray-400" title={c.alias_names}>
                      ชื่อเดิม: {formatAliasSummary(c.alias_names)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{c.tax_id ?? "—"}</TableCell>
                <TableCell className="px-4 py-3">{c.province ?? "—"}</TableCell>
                <TableCell className="px-4 py-3"><TypeBadge type={c.type} /></TableCell>
                <TableCell className="px-4 py-3"><StatusBadge status={c.status} /></TableCell>
                <TableCell className="px-4 py-3 text-gray-600">
                  {c.last_purchase_date
                    ? c.last_purchase_date.toLocaleDateString("th-TH")
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {c.last_purchase_total
                    ? Number(c.last_purchase_total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{formatSalespersonName(c.salesperson_name)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), ...(purchaseStatus !== "all" ? { purchase: purchaseStatus } : {}), page: String(page - 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), ...(purchaseStatus !== "all" ? { purchase: purchaseStatus } : {}), page: String(page + 1) })}`}
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
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {type ?? "ไม่ระบุ"}
    </Badge>
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
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {label[status] ?? status}
    </Badge>
  )
}

function formatAliasSummary(value: string) {
  const aliases = value
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean)
  if (aliases.length === 0) return "—"

  const first = aliases[0].length > 48 ? `${aliases[0].slice(0, 48)}...` : aliases[0]
  const remaining = aliases.length - 1
  return remaining > 0 ? `${first} +${remaining}` : first
}
