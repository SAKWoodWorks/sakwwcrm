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
import { Link } from "@/i18n/navigation"
import { getLocale, getTranslations } from "next-intl/server"
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
  { value: "30", labelKey: "lapsed30", min: 30, max: 59 },
  { value: "60", labelKey: "lapsed60", min: 60, max: 89 },
  { value: "90", labelKey: "lapsed90", min: 90, max: 364 },
  { value: "365", labelKey: "lapsed365", min: 365, max: null },
]

const PAGE_SIZE = 50

const PURCHASE_OPTIONS = [
  { value: "all", labelKey: "all" },
  { value: "purchased", labelKey: "purchased" },
  { value: "not_purchased", labelKey: "notPurchased" },
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
  const [t, locale] = await Promise.all([getTranslations("Customers"), getLocale()])
  const localeTag = toLocaleTag(locale)
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
            AND purchase_doc.doc_type IN ('tax_invoice', 'abb_invoice')
        )`
      : purchaseStatus === "not_purchased"
        ? Prisma.sql`AND NOT EXISTS (
            SELECT 1 FROM documents purchase_doc
            WHERE purchase_doc.customer_id = c.id
              AND purchase_doc.doc_type IN ('tax_invoice', 'abb_invoice')
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
          WHERE customer_id = c.id AND doc_type IN ('tax_invoice', 'abb_invoice')
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
        WHERE customer_id = c.id AND doc_type IN ('tax_invoice', 'abb_invoice')
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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Button asChild variant="outline" className="h-11 border-orange-200 bg-white font-semibold text-orange-700 hover:bg-orange-50">
            <Link href="/crm/customers/duplicates">{t("duplicates")}</Link>
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
                {t(`filters.${opt.labelKey}`)}{isActive && opt.value !== "all" ? " ✕" : ""}
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
                {t(`filters.${opt.labelKey}`)}{isActive ? " ✕" : ""}
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
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-semibold text-[var(--crm-muted)]">#{c.id}</span>
                    <h2 className="line-clamp-2 text-base font-bold text-[var(--crm-ink)]">{c.name}</h2>
                  </div>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">{c.tax_id ?? t("noTaxId")}</p>
                  {c.alias_names ? (
                    <p className="mt-1 truncate text-xs text-[var(--crm-muted)]" title={c.alias_names}>
                      {t("aliasPrefix", { aliases: formatAliasSummary(c.alias_names) })}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={c.status} labels={{
                  not_purchase_yet: t("status.not_purchase_yet"),
                  active: t("status.active"),
                  repeat: t("status.repeat"),
                  purchased: t("status.purchased"),
                }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">{t("table.province")}</p>
                  <p className="font-medium">{c.province ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">{t("table.lastPurchase")}</p>
                  <p className="font-medium">{c.last_purchase_date ? c.last_purchase_date.toLocaleDateString(localeTag) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">{t("table.lastTotal")}</p>
                  <p className="font-medium tabular-nums">
                    {c.last_purchase_total
                      ? Number(c.last_purchase_total).toLocaleString(localeTag, { style: "currency", currency: "THB", minimumFractionDigits: 0 })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">{t("table.salesperson")}</p>
                  <p className="font-medium">{formatSalespersonName(c.salesperson_name, t("unknownSalesperson"))}</p>
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
              <TableHead className="w-20 px-4 py-3 text-gray-500">ID</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">
                <Link href={sortUrl("name")} className="hover:text-gray-800">
                  {t("table.name")}{indicator("name")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">TAX ID</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.province")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.type")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.status")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">
                <Link href={sortUrl("last_purchase")} className="hover:text-gray-800">
                  {t("table.lastPurchase")}{indicator("last_purchase")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">
                <Link href={sortUrl("last_total")} className="hover:text-gray-800">
                  {t("table.lastTotal")}{indicator("last_total")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.salesperson")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 font-mono text-xs text-gray-500">#{c.id}</TableCell>
                <TableCell className="px-4 py-3">
                  <Link href={customerDetailUrl(c.id)} className="font-medium text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                  {c.alias_names ? (
                    <div className="mt-1 max-w-[24rem] truncate text-xs text-gray-400" title={c.alias_names}>
                      {t("aliasPrefix", { aliases: formatAliasSummary(c.alias_names) })}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{c.tax_id ?? "—"}</TableCell>
                <TableCell className="px-4 py-3">{c.province ?? "—"}</TableCell>
                <TableCell className="px-4 py-3"><TypeBadge type={c.type} fallback={t("unspecified")} /></TableCell>
                <TableCell className="px-4 py-3"><StatusBadge status={c.status} labels={{
                  not_purchase_yet: t("status.not_purchase_yet"),
                  active: t("status.active"),
                  repeat: t("status.repeat"),
                  purchased: t("status.purchased"),
                }} /></TableCell>
                <TableCell className="px-4 py-3 text-gray-600">
                  {c.last_purchase_date
                    ? c.last_purchase_date.toLocaleDateString(localeTag)
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {c.last_purchase_total
                    ? Number(c.last_purchase_total).toLocaleString(localeTag, {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{formatSalespersonName(c.salesperson_name, t("unknownSalesperson"))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0
            ? t("pagination.empty")
            : t("pagination.summary", {
                from: (skip + 1).toLocaleString(localeTag),
                to: Math.min(skip + PAGE_SIZE, total).toLocaleString(localeTag),
                total: total.toLocaleString(localeTag),
              })}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), ...(purchaseStatus !== "all" ? { purchase: purchaseStatus } : {}), page: String(page - 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              {t("pagination.previous")}
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), sort, order, ...(lapsedDays ? { lapsed: String(lapsedDays) } : {}), ...(purchaseStatus !== "all" ? { purchase: purchaseStatus } : {}), page: String(page + 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              {t("pagination.next")}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function TypeBadge({ type, fallback }: { type: string | null; fallback: string }) {
  const map: Record<string, string> = {
    retail: "bg-green-100 text-green-800",
    dealer: "bg-blue-100 text-blue-800",
    lazada: "bg-orange-100 text-orange-800",
    thai_watsadu: "bg-purple-100 text-purple-800",
  }
  const cls = (type && map[type]) ?? "bg-gray-100 text-gray-800"
  return (
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {type ?? fallback}
    </Badge>
  )
}

function StatusBadge({
  status,
  labels,
}: {
  status: string
  labels: Record<string, string>
}) {
  const map: Record<string, string> = {
    not_purchase_yet: "bg-gray-100 text-gray-600",
    active: "bg-yellow-100 text-yellow-800",
    repeat: "bg-green-100 text-green-800",
    purchased: "bg-green-100 text-green-800",
  }
  const cls = map[status] ?? "bg-gray-100 text-gray-600"
  return (
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {labels[status] ?? status}
    </Badge>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
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
