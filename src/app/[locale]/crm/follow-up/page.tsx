export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getLocale, getTranslations } from "next-intl/server"
import FollowUpFilters from "./FollowUpFilters"

type Props = {
  searchParams: Promise<{
    bucket?: string
    salesperson?: string
  }>
}

type FollowUpRow = {
  customer_id: number
  customer_name: string
  phone: string | null
  line_id: string | null
  salesperson_id: number | null
  salesperson_name: string | null
  last_paid_date: Date
  days_since_purchase: number | bigint
  last_invoice_total: Prisma.Decimal | number | null
  total_paid: Prisma.Decimal | number
  recent_products: string | null
}

type SalespersonOptionRow = {
  id: number
  name: string
}

type BucketKey = "30_59" | "60_89" | "90_179" | "180_plus"

const BUCKETS: BucketKey[] = ["30_59", "60_89", "90_179", "180_plus"]

export default async function FollowUpPage({ searchParams }: Props) {
  const query = await searchParams
  const selectedBucket = normalizeBucket(query.bucket)
  const selectedSalesperson = normalizeSalesperson(query.salesperson)
  const [t, locale, rows, salespersons] = await Promise.all([
    getTranslations("FollowUp"),
    getLocale(),
    getFollowUpRows(),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])
  const localeTag = toLocaleTag(locale)
  const salespersonOptions = salespersons.map((sp: SalespersonOptionRow) => ({
    value: String(sp.id),
    label: sp.name,
  }))
  const salespersonFilteredRows = rows.filter((row) => matchesSalesperson(row, selectedSalesperson))
  const bucketCounts = countBuckets(salespersonFilteredRows)
  const filteredRows = salespersonFilteredRows.filter((row) => matchesBucket(row, selectedBucket))

  return (
    <div className="crm-page">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("description")}</p>
        </div>
        <FollowUpFilters
          bucket={selectedBucket ?? "all"}
          salesperson={selectedSalesperson ?? "all"}
          salespersons={salespersonOptions}
        />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {BUCKETS.map((bucket) => (
          <SummaryCard
            key={bucket}
            label={bucketLabel(bucket, t)}
            count={bucketCounts[bucket]}
            localeTag={localeTag}
          />
        ))}
      </div>

      <div className="mb-3 text-sm text-[var(--crm-muted)]">
        {t("count", { count: filteredRows.length.toLocaleString(localeTag) })}
      </div>

      <div className="grid gap-3 md:hidden">
        {filteredRows.length === 0 ? (
          <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
            <CardContent className="p-5 text-sm text-[var(--crm-muted)]">{t("empty")}</CardContent>
          </Card>
        ) : (
          filteredRows.map((row) => (
            <Card key={row.customer_id} className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/crm/customers/${row.customer_id}`} className="font-semibold text-[var(--crm-ink)] hover:text-[var(--crm-brand)] hover:underline">
                      {row.customer_name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--crm-muted)]">{formatContact(row, t("noContact"))}</p>
                  </div>
                  <Badge variant="outline" className={bucketBadgeClass(bucketForDays(Number(row.days_since_purchase)))}>
                    {Number(row.days_since_purchase).toLocaleString(localeTag)}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Info label={t("table.salesperson")} value={row.salesperson_name ?? t("unknownSalesperson")} />
                  <Info label={t("table.lastPurchase")} value={formatDate(row.last_paid_date, localeTag)} />
                  <Info label={t("table.lastTotal")} value={formatCurrency(row.last_invoice_total, localeTag)} />
                  <Info label={t("table.totalPaid")} value={formatCurrency(row.total_paid, localeTag)} />
                </div>
                <p className="mt-3 text-xs text-[var(--crm-muted)]">{t("table.recentProducts")}</p>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--crm-ink)]">{row.recent_products ?? t("unknownProduct")}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.customer")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.contact")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.salesperson")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.lastPurchase")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.days")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.lastTotal")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.totalPaid")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.recentProducts")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.customer_id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 font-medium">
                    <Link href={`/crm/customers/${row.customer_id}`} className="text-[var(--crm-ink)] hover:text-[var(--crm-brand)] hover:underline">
                      {row.customer_name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{formatContact(row, t("noContact"))}</TableCell>
                  <TableCell className="px-4 py-3 text-gray-600">{row.salesperson_name ?? t("unknownSalesperson")}</TableCell>
                  <TableCell className="px-4 py-3 tabular-nums text-gray-600">{formatDate(row.last_paid_date, localeTag)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${bucketBadgeClass(bucketForDays(Number(row.days_since_purchase)))}`}>
                      {Number(row.days_since_purchase).toLocaleString(localeTag)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.last_invoice_total, localeTag)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">{formatCurrency(row.total_paid, localeTag)}</TableCell>
                  <TableCell className="max-w-[18rem] truncate px-4 py-3 text-gray-600" title={row.recent_products ?? undefined}>
                    {row.recent_products ?? t("unknownProduct")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SummaryCard({ label, count, localeTag }: { label: string; count: number; localeTag: string }) {
  return (
    <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
      <CardContent className="p-4">
        <p className="text-sm text-[var(--crm-muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--crm-ink)]">{count.toLocaleString(localeTag)}</p>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--crm-muted)]">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums text-[var(--crm-ink)]">{value}</p>
    </div>
  )
}

async function getFollowUpRows() {
  return prisma.$queryRaw<FollowUpRow[]>`
    WITH paid_docs AS (
      SELECT
        d.customer_id,
        d.id,
        d.doc_date,
        d.total,
        d.salesperson_id
      FROM documents d
      WHERE d.customer_id IS NOT NULL
        AND d.doc_type IN ('tax_invoice', 'abb_invoice')
        AND d.payment_status = 'paid'
    ),
    customer_totals AS (
      SELECT
        customer_id,
        MAX(doc_date) AS last_paid_date,
        COALESCE(SUM(total), 0) AS total_paid
      FROM paid_docs
      GROUP BY customer_id
    ),
    last_docs AS (
      SELECT DISTINCT ON (customer_id)
        customer_id,
        total AS last_invoice_total,
        salesperson_id
      FROM paid_docs
      ORDER BY customer_id, doc_date DESC, id DESC
    ),
    product_rank AS (
      SELECT
        pd.customer_id,
        COALESCE(p.full_name, di.description) AS product_name,
        MAX(pd.doc_date) AS last_product_date,
        ROW_NUMBER() OVER (
          PARTITION BY pd.customer_id
          ORDER BY MAX(pd.doc_date) DESC, COALESCE(p.full_name, di.description) ASC
        ) AS product_rank
      FROM paid_docs pd
      JOIN document_items di ON di.document_id = pd.id
      LEFT JOIN products p ON p.id = di.product_id
      WHERE COALESCE(p.full_name, di.description) IS NOT NULL
      GROUP BY pd.customer_id, COALESCE(p.full_name, di.description)
    ),
    recent_products AS (
      SELECT
        customer_id,
        string_agg(product_name, ', ' ORDER BY last_product_date DESC, product_name ASC) AS recent_products
      FROM product_rank
      WHERE product_rank <= 3
      GROUP BY customer_id
    )
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone,
      c.line_id,
      COALESCE(c.salesperson_id, ld.salesperson_id) AS salesperson_id,
      COALESCE(csp.name, lsp.name) AS salesperson_name,
      ct.last_paid_date,
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE::timestamp - ct.last_paid_date)) / 86400))::int AS days_since_purchase,
      ld.last_invoice_total,
      ct.total_paid,
      rp.recent_products
    FROM customer_totals ct
    JOIN customers c ON c.id = ct.customer_id
    LEFT JOIN last_docs ld ON ld.customer_id = ct.customer_id
    LEFT JOIN salespersons csp ON csp.id = c.salesperson_id
    LEFT JOIN salespersons lsp ON lsp.id = ld.salesperson_id
    LEFT JOIN recent_products rp ON rp.customer_id = ct.customer_id
    WHERE ct.last_paid_date <= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY days_since_purchase DESC, ct.total_paid DESC, c.name ASC
  `
}

function matchesSalesperson(row: FollowUpRow, selectedSalesperson: string | null) {
  if (!selectedSalesperson) return true
  if (selectedSalesperson === "none") return row.salesperson_id == null
  return String(row.salesperson_id) === selectedSalesperson
}

function matchesBucket(row: FollowUpRow, selectedBucket: BucketKey | null) {
  if (!selectedBucket) return true
  return bucketForDays(Number(row.days_since_purchase)) === selectedBucket
}

function countBuckets(rows: FollowUpRow[]) {
  return rows.reduce<Record<BucketKey, number>>(
    (counts, row) => {
      counts[bucketForDays(Number(row.days_since_purchase))] += 1
      return counts
    },
    { "30_59": 0, "60_89": 0, "90_179": 0, "180_plus": 0 },
  )
}

function bucketForDays(days: number): BucketKey {
  if (days < 60) return "30_59"
  if (days < 90) return "60_89"
  if (days < 180) return "90_179"
  return "180_plus"
}

function bucketLabel(bucket: BucketKey, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (bucket === "30_59") return t("summary.days30")
  if (bucket === "60_89") return t("summary.days60")
  if (bucket === "90_179") return t("summary.days90")
  return t("summary.days180")
}

function bucketBadgeClass(bucket: BucketKey) {
  if (bucket === "30_59") return "border-yellow-200 bg-yellow-100 text-yellow-800"
  if (bucket === "60_89") return "border-orange-200 bg-orange-100 text-orange-800"
  if (bucket === "90_179") return "border-red-200 bg-red-100 text-red-800"
  return "border-purple-200 bg-purple-100 text-purple-800"
}

function normalizeBucket(value?: string): BucketKey | null {
  return BUCKETS.includes(value as BucketKey) ? (value as BucketKey) : null
}

function normalizeSalesperson(value?: string) {
  if (!value || value === "all") return null
  if (value === "none") return "none"
  return /^\d+$/.test(value) ? value : null
}

function formatContact(row: FollowUpRow, fallback: string) {
  const values = [row.phone, row.line_id ? `LINE: ${row.line_id}` : null].filter(Boolean)
  return values.length > 0 ? values.join(" / ") : fallback
}

function formatDate(value: Date, localeTag: string) {
  return value.toLocaleDateString(localeTag)
}

function formatCurrency(value: Prisma.Decimal | number | null, localeTag: string) {
  if (value == null) return "—"
  return Number(value).toLocaleString(localeTag, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
