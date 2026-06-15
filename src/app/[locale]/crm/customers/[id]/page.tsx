export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DocTypeBadge } from "@/app/[locale]/crm/documents/DocTypeBadge"
import { CustomerDocumentFilters } from "@/app/[locale]/crm/customers/[id]/CustomerDocumentFilters"
import { UndoMergeButton } from "@/app/[locale]/crm/customers/[id]/UndoMergeButton"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { formatSalespersonName } from "@/lib/salesperson-display"
import type { ReactNode } from "react"

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{
    returnTo?: string
    docPage?: string
    docPageSize?: string
    docType?: string
    docSort?: string
  }>
}

type CustomerAliasRow = {
  alias_name: string
  alias_type: string
  tax_id: string | null
  note: string | null
}

type CustomerMergeAuditRow = {
  id: number
  actor_email: string | null
  created_at: Date
  metadata: unknown
}

type TopCustomerRankRow = {
  purchase_rank: bigint | number
  total_paid: Prisma.Decimal | number
  total_invoices: bigint
}

type CustomerDocumentStatsRow = {
  total_spend: Prisma.Decimal | number | null
  last_purchase: Date | null
  salesperson_name: string | null
}

type CustomerDocumentRow = {
  id: number
  doc_type: string
  doc_number: string
  doc_date: Date
  channel: string | null
  payment_status: string | null
  total: Prisma.Decimal | number | null
  salesperson_name: string | null
}

type CustomerDocumentCountRow = {
  document_count: bigint | number
}

type CustomerProductRow = {
  product_id: number | null
  sku_code: string | null
  product_name: string | null
  description: string | null
  total_qty: Prisma.Decimal | number
  total_amount: Prisma.Decimal | number
  invoice_count: bigint
  last_purchase_date: Date | null
}

const DOCUMENT_PAGE_SIZES = [10, 25, 50, 100]
const DOCUMENT_SORTS = {
  doc_date_desc: Prisma.sql`d.doc_date DESC, d.id DESC`,
  doc_date_asc: Prisma.sql`d.doc_date ASC, d.id ASC`,
  total_desc: Prisma.sql`d.total DESC NULLS LAST, d.doc_date DESC`,
  total_asc: Prisma.sql`d.total ASC NULLS LAST, d.doc_date DESC`,
  doc_number_asc: Prisma.sql`d.doc_number ASC`,
  doc_number_desc: Prisma.sql`d.doc_number DESC`,
  doc_type_asc: Prisma.sql`d.doc_type ASC, d.doc_date DESC`,
} as const

type DocumentSortKey = keyof typeof DOCUMENT_SORTS

export default async function CustomerDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const t = await getTranslations("CustomerDetail")
  const locale = await getLocale()
  const localeTag = toLocaleTag(locale)
  const { returnTo } = query
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) notFound()

  const docPageSize = getDocumentPageSize(query.docPageSize)
  const docPage = getDocumentPage(query.docPage)
  const docType = getDocumentType(query.docType)
  const docSort = getDocumentSort(query.docSort)
  const documentFilter = getDocumentFilter(docType)
  const documentOffset = (docPage - 1) * docPageSize

  const [customer, aliases, topCustomerRanks, documentStats, customerProducts, documents, documentCounts, mergeAudits] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesperson: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<CustomerAliasRow[]>`
      SELECT alias_name, alias_type, tax_id, note
      FROM customer_aliases
      WHERE customer_id = ${customerId}
      ORDER BY alias_name ASC
    `,
    prisma.$queryRaw<TopCustomerRankRow[]>`
      WITH ranked_customers AS (
        SELECT
          d.customer_id,
          SUM(d.total) AS total_paid,
          COUNT(d.id) AS total_invoices,
          RANK() OVER (ORDER BY SUM(d.total) DESC) AS purchase_rank
        FROM documents d
        WHERE d.doc_type = 'tax_invoice'
          AND d.payment_status = 'paid'
        GROUP BY d.customer_id
      )
      SELECT purchase_rank, total_paid, total_invoices
      FROM ranked_customers
      WHERE customer_id = ${customerId}
        AND purchase_rank <= 100
      LIMIT 1
    `,
    prisma.$queryRaw<CustomerDocumentStatsRow[]>`
      SELECT
        COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0) AS total_spend,
        MAX(d.doc_date) FILTER (WHERE d.doc_type = 'tax_invoice') AS last_purchase,
        COALESCE(csp.name, MAX(sp.name)) AS salesperson_name
      FROM customers c
      LEFT JOIN documents d ON d.customer_id = c.id
      LEFT JOIN salespersons sp ON sp.id = d.salesperson_id
      LEFT JOIN salespersons csp ON csp.id = c.salesperson_id
      WHERE c.id = ${customerId}
      GROUP BY c.id, csp.name
    `,
    prisma.$queryRaw<CustomerProductRow[]>`
      SELECT
        di.product_id,
        p.sku_code,
        p.full_name AS product_name,
        CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END AS description,
        COALESCE(SUM(di.quantity), 0) AS total_qty,
        COALESCE(SUM(di.total), 0) AS total_amount,
        COUNT(DISTINCT d.id) AS invoice_count,
        MAX(d.doc_date) AS last_purchase_date
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      LEFT JOIN products p ON p.id = di.product_id
      WHERE d.customer_id = ${customerId}
        AND d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
      GROUP BY di.product_id, p.sku_code, p.full_name, CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END
      ORDER BY total_amount DESC
      LIMIT 20
    `,
    prisma.$queryRaw<CustomerDocumentRow[]>`
      SELECT
        d.id,
        d.doc_type,
        d.doc_number,
        d.doc_date,
        d.channel,
        d.payment_status,
        d.total,
        sp.name AS salesperson_name
      FROM documents d
      LEFT JOIN salespersons sp ON sp.id = d.salesperson_id
      WHERE d.customer_id = ${customerId}
        ${documentFilter}
      ORDER BY ${DOCUMENT_SORTS[docSort]}
      LIMIT ${docPageSize}
      OFFSET ${documentOffset}
    `,
    prisma.$queryRaw<CustomerDocumentCountRow[]>`
      SELECT COUNT(*) AS document_count
      FROM documents d
      WHERE d.customer_id = ${customerId}
        ${documentFilter}
    `,
    getCustomerMergeAudits(customerId),
  ])

  if (!customer) notFound()

  const stats = documentStats[0]
  const totalSpend = stats?.total_spend ?? 0
  const lastPurchase = stats?.last_purchase
  const lastPurchaseLabel = lastPurchase ? formatDate(lastPurchase, localeTag) : t("noData")
  const salespersonName = customer.salesperson?.name ?? stats?.salesperson_name
  const backHref = getSafeCustomersReturnUrl(returnTo)
  const topCustomerRank = topCustomerRanks[0]
  const totalDocuments = Number(documentCounts[0]?.document_count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalDocuments / docPageSize))
  const safeDocPage = Math.min(docPage, totalPages)
  const pageStart = documents.length === 0 ? 0 : documentOffset + 1
  const pageEnd = Math.min(documentOffset + documents.length, totalDocuments)

  return (
    <div className="crm-page max-w-5xl">
      <div className="mb-4">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
      </div>

      <Card
        className={`mb-6 rounded-lg bg-white shadow-[var(--crm-shadow)] ${
          topCustomerRank
            ? "border-[#d0aa45] bg-[linear-gradient(135deg,#fffdf7_0%,#ffffff_42%,#fff6d8_100%)]"
            : "border-[var(--crm-line)]"
        }`}
      >
        <CardContent className="p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{customer.name}</h1>
              {topCustomerRank ? <TopCustomerBadge rank={Number(topCustomerRank.purchase_rank)} localeTag={localeTag} /> : null}
            </div>
            {topCustomerRank ? (
              <p className="mt-1 text-xs font-medium text-[#7a5614]">
                {t("topCustomer", { total: formatCurrency(topCustomerRank.total_paid, localeTag) })}
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/crm/customers/${customer.id}/edit`}>{t("edit")}</Link>
          </Button>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <MetricCard
            label={t("metrics.totalSpend")}
            value={formatCurrency(totalSpend, localeTag)}
            detail={t("metrics.totalSpendDetail")}
            tone="gold"
          />
          <MetricCard
            label={t("metrics.lastPurchase")}
            value={lastPurchaseLabel}
            detail={t("metrics.lastPurchaseDetail")}
            tone="blue"
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
          <InfoRow label="TAX ID" value={customer.taxId ?? "—"} />
          <InfoRow label={t("info.province")} value={customer.province ?? "—"} />
          <InfoRow label={t("info.type")} value={customer.type ?? "—"} />
          <InfoRow label={t("info.status")} value={formatCustomerStatus(customer.status, t)} />
          <InfoRow label="VAT" value={customer.vatRegistered ? t("info.vatRegistered") : t("info.vatNotRegistered")} />
          <InfoRow label="Salesperson" value={formatSalespersonName(salespersonName)} />
          <InfoRow label={t("info.phone")} value={customer.phone ?? "—"} />
          <InfoRow label={t("info.email")} value={customer.email ?? "—"} />
          <InfoRow label="LINE" value={customer.lineId ?? "—"} />
          <InfoRow label={t("info.address")} value={customer.address ?? "—"} />
        </dl>
        {aliases.length > 0 ? (
          <details className="group mt-5 border-t border-gray-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
              <span>{t("aliases.title", { count: aliases.length })}</span>
              <span className="text-xs font-medium text-gray-500 group-open:hidden">{t("aliases.show")}</span>
              <span className="hidden text-xs font-medium text-gray-500 group-open:inline">{t("aliases.hide")}</span>
            </summary>
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md border border-gray-100 bg-white p-3">
              {aliases.map((alias) => (
                <Badge
                  key={`${alias.alias_type}-${alias.alias_name}`}
                  variant="outline"
                  className="max-w-full truncate border-blue-100 bg-blue-50 text-blue-800"
                  title={alias.note ?? alias.alias_name}
                >
                  {alias.alias_name}
                  {alias.tax_id ? ` (${alias.tax_id})` : ""}
                </Badge>
              ))}
            </div>
          </details>
        ) : null}
        {mergeAudits.length > 0 ? (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-700">{t("merge.title")}</h2>
            <div className="mt-2 grid gap-2">
              {mergeAudits.map((audit, index) => {
                const mergedIds = getMergedIds(audit.metadata)
                const undoable = isUndoableMerge(audit.metadata)
                return (
                  <div
                    key={`${audit.created_at.toISOString()}-${index}`}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-medium text-gray-900">
                        {t("merge.mergedIntoThis", { ids: formatMergedIds(mergedIds, t) })}
                      </p>
                      {undoable ? <UndoMergeButton auditId={audit.id} restoredIds={mergedIds} /> : null}
                    </div>
                    <p className="mt-1">{audit.actor_email ?? t("merge.unknownUser")}</p>
                    <p>{formatDateTime(audit.created_at, localeTag)}</p>
                    {!undoable && isMergeVersion2(audit.metadata) ? (
                      <p className="mt-1 text-red-600">{t("merge.undone")}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("documents.title", { count: formatNumber(totalDocuments, localeTag) })}</h2>
          <p className="mt-1 text-xs text-[var(--crm-muted)]">
            {t("documents.summary", { from: formatNumber(pageStart, localeTag), to: formatNumber(pageEnd, localeTag), total: formatNumber(totalDocuments, localeTag) })}
          </p>
        </div>
        <CustomerDocumentFilters
          returnTo={returnTo}
          docType={docType}
          docPageSize={docPageSize}
          docSort={docSort}
        />
      </div>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">
                <SortLink href={buildDocumentHref(customer.id, query, { docSort: toggleSort(docSort, "doc_date") })} active={docSort.startsWith("doc_date")}>
                  {t("documents.date")}
                </SortLink>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">
                <SortLink href={buildDocumentHref(customer.id, query, { docSort: toggleSort(docSort, "doc_number") })} active={docSort.startsWith("doc_number")}>
                  {t("documents.number")}
                </SortLink>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">
                <SortLink href={buildDocumentHref(customer.id, query, { docSort: "doc_type_asc" })} active={docSort === "doc_type_asc"}>
                  {t("documents.type")}
                </SortLink>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("documents.channel")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("documents.salesperson")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">
                <SortLink href={buildDocumentHref(customer.id, query, { docSort: toggleSort(docSort, "total") })} active={docSort.startsWith("total")}>
                  {t("documents.total")}
                </SortLink>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("documents.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  {t("documents.empty")}
                </TableCell>
              </TableRow>
            ) : documents.map((d) => (
              <TableRow key={d.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 tabular-nums">
                  {formatDate(d.doc_date, localeTag)}
                </TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/crm/documents/${d.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {d.doc_number}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <DocTypeBadge docType={d.doc_type} />
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</TableCell>
                <TableCell className="px-4 py-3">{formatSalespersonName(d.salesperson_name)}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {d.total != null
                    ? formatCurrency(d.total, localeTag)
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {d.doc_type === "tax_invoice" ? (
                    <PaymentBadge status={d.payment_status} t={t} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DocumentPagination
        customerId={customer.id}
        query={query}
        currentPage={safeDocPage}
        totalPages={totalPages}
        totalDocuments={totalDocuments}
        localeTag={localeTag}
        t={t}
      />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{t("products.title", { count: formatNumber(customerProducts.length, localeTag) })}</h2>
          <p className="text-sm text-[var(--crm-muted)]">{t("products.description")}</p>
        </div>
        <div className="grid gap-3 md:hidden">
          {customerProducts.length === 0 ? (
            <div className="rounded-lg border border-[var(--crm-line)] bg-white p-4 text-center text-sm text-gray-400 shadow-[var(--crm-shadow)]">
              {t("products.empty")}
            </div>
          ) : customerProducts.map((product, index) => (
            <div key={`${product.product_id ?? "desc"}-${product.sku_code ?? product.description}-mobile`} className="rounded-lg border border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500">#{formatNumber(index + 1, localeTag)}</p>
                  <p className="mt-1 line-clamp-2 font-semibold text-gray-900">{productName(product, t)}</p>
                </div>
                <p className="shrink-0 text-right font-semibold tabular-nums text-[#7a5614]">
                  {formatCurrency(product.total_amount, localeTag)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div>
                  <p className="text-gray-400">{t("products.quantity")}</p>
                  <p className="mt-0.5 font-medium tabular-nums text-gray-900">{formatQty(product.total_qty, localeTag)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t("products.invoice")}</p>
                  <p className="mt-0.5 font-medium tabular-nums text-gray-900">{formatNumber(Number(product.invoice_count), localeTag)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t("products.latest")}</p>
                  <p className="mt-0.5 font-medium tabular-nums text-gray-900">
                    {product.last_purchase_date ? formatDate(product.last_purchase_date, localeTag) : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden rounded-lg border border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)] md:block">
          <Table className="w-full table-fixed">
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-12 px-3 py-3 text-right text-gray-500">#</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">{t("products.product")}</TableHead>
                <TableHead className="w-24 px-3 py-3 text-right text-gray-500">{t("products.quantity")}</TableHead>
                <TableHead className="w-20 px-3 py-3 text-right text-gray-500">{t("products.bills")}</TableHead>
                <TableHead className="w-28 px-3 py-3 text-gray-500">{t("products.latest")}</TableHead>
                <TableHead className="w-32 px-3 py-3 text-right text-gray-500">{t("products.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    {t("products.empty")}
                  </TableCell>
                </TableRow>
              ) : customerProducts.map((product, index) => (
                <TableRow key={`${product.product_id ?? "desc"}-${product.sku_code ?? product.description}`} className="hover:bg-gray-50">
                  <TableCell className="px-3 py-3 text-right tabular-nums text-gray-500">
                    {formatNumber(index + 1, localeTag)}
                  </TableCell>
                  <TableCell className="truncate px-3 py-3 font-medium text-gray-900" title={productName(product, t)}>
                    {productName(product, t)}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right tabular-nums">{formatQty(product.total_qty, localeTag)}</TableCell>
                  <TableCell className="px-3 py-3 text-right tabular-nums">{formatNumber(Number(product.invoice_count), localeTag)}</TableCell>
                  <TableCell className="px-3 py-3 tabular-nums text-gray-600">
                    {product.last_purchase_date ? formatDate(product.last_purchase_date, localeTag) : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right tabular-nums font-semibold text-[#7a5614]">
                    {formatCurrency(product.total_amount, localeTag)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
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

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: "gold" | "blue"
}) {
  const styles =
    tone === "gold"
      ? "border-[#d0aa45] bg-[#fff8dc] text-[#6f4d11]"
      : "border-blue-200 bg-blue-50 text-blue-900"

  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-70">{detail}</p>
    </div>
  )
}

function DocumentPagination({
  customerId,
  query,
  currentPage,
  totalPages,
  totalDocuments,
  localeTag,
  t,
}: {
  customerId: number
  query: Awaited<NonNullable<Props["searchParams"]>>
  currentPage: number
  totalPages: number
  totalDocuments: number
  localeTag: string
  t: Awaited<ReturnType<typeof getTranslations>>
}) {
  if (totalDocuments === 0) return null

  return (
    <div className="mt-4 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
      <p className="text-[var(--crm-muted)]">
        {t("pagination.page", { current: formatNumber(currentPage, localeTag), total: formatNumber(totalPages, localeTag) })}
      </p>
      <div className="flex gap-2">
        {currentPage <= 1 ? (
          <Button variant="outline" size="sm" disabled>{t("pagination.previous")}</Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildDocumentHref(customerId, query, { docPage: currentPage - 1 })}>{t("pagination.previous")}</Link>
          </Button>
        )}
        {currentPage >= totalPages ? (
          <Button variant="outline" size="sm" disabled>{t("pagination.next")}</Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildDocumentHref(customerId, query, { docPage: currentPage + 1 })}>{t("pagination.next")}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function SortLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 font-semibold hover:text-[var(--crm-brand)] hover:underline ${
        active ? "text-[var(--crm-brand)]" : "text-gray-500"
      }`}
    >
      {children}
    </Link>
  )
}

function TopCustomerBadge({ rank, localeTag }: { rank: number; localeTag: string }) {
  return (
    <Badge
      variant="outline"
      className="border-[#c49a32] bg-[#fff1b8] text-[#6f4d11] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
    >
      Top 100 #{formatNumber(rank, localeTag)}
    </Badge>
  )
}

function formatCurrency(value: Prisma.Decimal | number, localeTag: string) {
  return Number(value).toLocaleString(localeTag, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatQty(value: Prisma.Decimal | number, localeTag: string) {
  return Number(value).toLocaleString(localeTag, {
    maximumFractionDigits: 3,
  })
}

function formatNumber(value: number, localeTag: string) {
  return value.toLocaleString(localeTag)
}

function formatDate(value: Date, localeTag: string) {
  return value.toLocaleDateString(localeTag)
}

function formatDateTime(value: Date, localeTag: string) {
  return value.toLocaleString(localeTag)
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}

function productName(row: CustomerProductRow, t: Awaited<ReturnType<typeof getTranslations>>) {
  return row.product_name ?? row.description ?? t("products.unknown")
}

function formatCustomerStatus(status: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  if (status === "not_purchase_yet") return t("status.not_purchase_yet")
  if (status === "active") return t("status.active")
  if (status === "inactive") return t("status.inactive")
  return status
}

function getDocumentPage(value?: string) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function getDocumentPageSize(value?: string) {
  const size = Number(value)
  return DOCUMENT_PAGE_SIZES.includes(size) ? size : 25
}

function getDocumentType(value?: string) {
  if (value === "tax_invoice" || value === "quotation") return value
  return "all"
}

function getDocumentSort(value?: string): DocumentSortKey {
  if (value && value in DOCUMENT_SORTS) return value as DocumentSortKey
  return "doc_date_desc"
}

function getDocumentFilter(docType: string) {
  if (docType === "tax_invoice") return Prisma.sql`AND d.doc_type = 'tax_invoice'`
  if (docType === "quotation") return Prisma.sql`AND d.doc_type = 'quotation'`
  return Prisma.sql``
}

function toggleSort(current: DocumentSortKey, field: "doc_date" | "doc_number" | "total"): DocumentSortKey {
  const desc = `${field}_desc` as DocumentSortKey
  const asc = `${field}_asc` as DocumentSortKey
  return current === desc ? asc : desc
}

function buildDocumentHref(
  customerId: number,
  query: Awaited<NonNullable<Props["searchParams"]>>,
  next: { docPage?: number; docPageSize?: number; docType?: string; docSort?: DocumentSortKey },
) {
  const params = new URLSearchParams()
  if (query.returnTo) params.set("returnTo", query.returnTo)
  params.set("docType", next.docType ?? getDocumentType(query.docType))
  params.set("docPageSize", String(next.docPageSize ?? getDocumentPageSize(query.docPageSize)))
  params.set("docSort", next.docSort ?? getDocumentSort(query.docSort))
  params.set("docPage", String(next.docPage ?? 1))

  return `/crm/customers/${customerId}?${params.toString()}`
}

function getMergedIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("mergedIds" in metadata)) return []

  const ids = (metadata as { mergedIds?: unknown }).mergedIds
  if (!Array.isArray(ids)) return []

  return ids.map(Number).filter(Number.isInteger)
}

function formatMergedIds(ids: number[], t: Awaited<ReturnType<typeof getTranslations>>) {
  if (ids.length === 0) return t("merge.otherRecord")
  return ids.map((id) => `#${id}`).join(", ")
}

function isMergeVersion2(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && (metadata as { mergeVersion?: unknown }).mergeVersion === 2)
}

function isUndoableMerge(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false

  const data = metadata as { mergeVersion?: unknown; undoable?: unknown; undoneAt?: unknown; movedDocuments?: unknown }
  return data.mergeVersion === 2 && data.undoable === true && !data.undoneAt && Array.isArray(data.movedDocuments)
}

function getSafeCustomersReturnUrl(value?: string) {
  if (!value) return "/crm/customers"
  if (value.startsWith("/crm/top-customers")) return value
  if (!value.startsWith("/crm/customers")) return "/crm/customers"
  if (value.startsWith("/crm/customers/")) return "/crm/customers"
  return value
}

async function getCustomerMergeAudits(customerId: number) {
  try {
    return await prisma.$queryRaw<CustomerMergeAuditRow[]>`
      SELECT id, actor_email, created_at, metadata
      FROM audit_logs
      WHERE action = 'customer.merge'
        AND target_type = 'customer'
        AND target_id = ${customerId}
      ORDER BY created_at DESC
      LIMIT 10
    `
  } catch (error) {
    if (isMissingAuditLogsTableError(error)) return []
    throw error
  }
}

function isMissingAuditLogsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const err = error as {
    code?: unknown
    message?: unknown
    meta?: { code?: unknown; message?: unknown }
  }
  const message = `${String(err.message ?? "")} ${String(err.meta?.message ?? "")}`

  return (
    (err.code === "P2010" && err.meta?.code === "42P01" && message.includes("audit_logs")) ||
    (message.includes('relation "audit_logs" does not exist') || message.includes("relation audit_logs does not exist"))
  )
}

function PaymentBadge({ status, t }: { status: string | null; t: Awaited<ReturnType<typeof getTranslations>> }) {
  if (status === "paid") {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
        {t("payment.paid")}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-yellow-200 bg-yellow-100 text-yellow-800">
      {t("payment.pending")}
    </Badge>
  )
}
