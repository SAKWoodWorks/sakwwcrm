export const dynamic = "force-dynamic"

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
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Pencil } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"
import ProductCategoryBadge from "../ProductCategoryBadge"

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ docType?: string }>
}

type ProductStatsRow = {
  paid_qty: Prisma.Decimal | number | null
  paid_amount: Prisma.Decimal | number | null
  paid_invoice_count: bigint | number
  quoted_qty: Prisma.Decimal | number | null
  quoted_amount: Prisma.Decimal | number | null
  quote_count: bigint | number
  last_invoice_date: Date | null
}

type ProductDocumentRow = {
  document_id: number
  doc_number: string
  doc_date: Date
  doc_type: string
  payment_status: string | null
  customer_id: number | null
  customer_name: string | null
  quantity: Prisma.Decimal | number | null
  total: Prisma.Decimal | number | null
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { docType } = (await searchParams) ?? {}
  const [t, locale] = await Promise.all([getTranslations("ProductDetail"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const productId = parseInt(id, 10)
  if (isNaN(productId) || String(productId) !== id) notFound()
  const selectedDocType = normalizeDocType(docType)
  const documentTypeFilter = selectedDocType
    ? Prisma.sql`AND d.doc_type = ${selectedDocType}`
    : Prisma.empty

  const [product, statsRows, documents] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        skuCode: true,
        fullName: true,
        category: true,
        grade: true,
        thickness: true,
        width: true,
        length: true,
        weight: true,
        volume: true,
        wsCost: true,
        rtCost: true,
        dateLastCostAdj: true,
        dateLastInvoice: true,
        totalQtyInvoiced: true,
        totalAmountInvoiced: true,
        totalQtyQuoted: true,
        totalAmountQuoted: true,
      },
    }),
    prisma.$queryRaw<ProductStatsRow[]>`
      SELECT
        COALESCE(SUM(di.quantity) FILTER (WHERE d.doc_type = 'tax_invoice' AND d.payment_status = 'paid'), 0) AS paid_qty,
        COALESCE(SUM(di.total) FILTER (WHERE d.doc_type = 'tax_invoice' AND d.payment_status = 'paid'), 0) AS paid_amount,
        COUNT(DISTINCT d.id) FILTER (WHERE d.doc_type = 'tax_invoice' AND d.payment_status = 'paid') AS paid_invoice_count,
        COALESCE(SUM(di.quantity) FILTER (WHERE d.doc_type = 'quotation'), 0) AS quoted_qty,
        COALESCE(SUM(di.total) FILTER (WHERE d.doc_type = 'quotation'), 0) AS quoted_amount,
        COUNT(DISTINCT d.id) FILTER (WHERE d.doc_type = 'quotation') AS quote_count,
        MAX(d.doc_date) FILTER (WHERE d.doc_type = 'tax_invoice' AND d.payment_status = 'paid') AS last_invoice_date
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      WHERE di.product_id = ${productId}
    `,
    prisma.$queryRaw<ProductDocumentRow[]>`
      SELECT
        d.id AS document_id,
        d.doc_number,
        d.doc_date,
        d.doc_type,
        d.payment_status,
        c.id AS customer_id,
        c.name AS customer_name,
        SUM(di.quantity) AS quantity,
        SUM(di.total) AS total
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE di.product_id = ${productId}
        ${documentTypeFilter}
      GROUP BY d.id, d.doc_number, d.doc_date, d.doc_type, d.payment_status, c.id, c.name
      ORDER BY d.doc_date DESC, d.id DESC
      LIMIT 50
    `,
  ])

  if (!product) notFound()
  const stats = statsRows[0]

  return (
    <div className="crm-page max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/crm/products" className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href={`/crm/products/${product.id}/edit`}>
            <Pencil />
            <span>{t("edit")}</span>
          </Link>
        </Button>
      </div>

      <section className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-[var(--crm-brand)]">{product.skuCode}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-snug text-[var(--crm-ink)]">{product.fullName}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.category ? <ProductCategoryBadge category={product.category} /> : null}
              {product.grade ? (
                <span className="rounded-md border border-[var(--crm-line)] bg-white px-2 py-1 text-xs font-medium text-[var(--crm-muted)]">
                  {t("grade", { grade: product.grade })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <MetricCard label={t("metrics.totalSales")} value={formatBaht(stats?.paid_amount ?? 0, localeTag)} tone="gold" />
        <MetricCard label={t("metrics.soldQty")} value={formatQty(stats?.paid_qty ?? 0, localeTag)} tone="green" />
        <MetricCard label={t("metrics.paidInvoices")} value={Number(stats?.paid_invoice_count ?? 0).toLocaleString(localeTag)} tone="blue" />
        <MetricCard label={t("metrics.lastSale")} value={stats?.last_invoice_date ? stats.last_invoice_date.toLocaleDateString(localeTag) : "—"} tone="gray" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
          <CardContent className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-[var(--crm-ink)]">{t("info.title")}</h2>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow label={t("info.size")} value={formatSize(product.thickness, product.width, product.length, localeTag)} />
              <InfoRow label={t("info.weight")} value={product.weight != null ? `${Number(product.weight).toLocaleString(localeTag)} kg` : "—"} />
              <InfoRow label={t("info.volume")} value={product.volume != null ? Number(product.volume).toLocaleString(localeTag, { maximumFractionDigits: 4 }) : "—"} />
              <InfoRow label={t("info.wholesale")} value={product.wsCost != null ? formatPlainMoney(product.wsCost, localeTag) : "—"} />
              <InfoRow label={t("info.retail")} value={product.rtCost != null ? formatPlainMoney(product.rtCost, localeTag) : "—"} />
              <InfoRow label={t("info.lastCost")} value={product.dateLastCostAdj ? product.dateLastCostAdj.toLocaleDateString(localeTag) : "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
          <CardContent className="p-5">
            <h2 className="mb-4 text-lg font-semibold text-[var(--crm-ink)]">{t("quotation.title")}</h2>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <InfoRow label={t("quotation.qty")} value={formatQty(stats?.quoted_qty ?? 0, localeTag)} />
              <InfoRow label={t("quotation.amount")} value={formatBaht(stats?.quoted_amount ?? 0, localeTag)} />
              <InfoRow label={t("quotation.count")} value={Number(stats?.quote_count ?? 0).toLocaleString(localeTag)} />
              <InfoRow label={t("quotation.productTotal")} value={formatBaht(product.totalAmountInvoiced ?? 0, localeTag)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{t("documents.title", { count: documents.length })}</h2>
          <nav className="flex w-fit rounded-md border border-[var(--crm-line)] bg-white p-1 text-sm" aria-label={t("documents.ariaLabel")}>
            <DocumentTypeLink productId={product.id} label={t("documents.all")} active={!selectedDocType} />
            <DocumentTypeLink productId={product.id} label={t("documents.invoice")} docType="invoice" active={selectedDocType === "tax_invoice"} />
            <DocumentTypeLink productId={product.id} label={t("documents.quotation")} docType="quotation" active={selectedDocType === "quotation"} />
          </nav>
        </div>
        <div className="crm-table-wrap">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-3 py-3 text-gray-500">{t("documents.date")}</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">{t("documents.document")}</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">{t("documents.customer")}</TableHead>
                <TableHead className="px-3 py-3 text-right text-gray-500">{t("documents.quantity")}</TableHead>
                <TableHead className="px-3 py-3 text-right text-gray-500">{t("documents.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    {t("documents.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.document_id} className="hover:bg-gray-50">
                    <TableCell className="px-3 py-2 tabular-nums">{doc.doc_date.toLocaleDateString(localeTag)}</TableCell>
                    <TableCell className="px-3 py-2">
                      <Link href={`/crm/documents/${doc.document_id}`} className="font-mono text-xs text-blue-600 hover:underline">
                        {doc.doc_number}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--crm-muted)]">{doc.doc_type === "tax_invoice" ? t("documents.taxInvoice") : t("documents.quotation")}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {doc.customer_id && doc.customer_name ? (
                        <Link href={`/crm/customers/${doc.customer_id}`} className="text-blue-600 hover:underline">
                          {doc.customer_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">{formatQty(doc.quantity ?? 0, localeTag)}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums font-medium">{formatBaht(doc.total ?? 0, localeTag)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function normalizeDocType(value?: string) {
  if (value === "invoice") return "tax_invoice"
  if (value === "quotation") return "quotation"
  return null
}

function DocumentTypeLink({
  productId,
  label,
  docType,
  active,
}: {
  productId: number
  label: string
  docType?: "invoice" | "quotation"
  active: boolean
}) {
  const href = docType ? `/crm/products/${productId}?docType=${docType}` : `/crm/products/${productId}`
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded px-3 py-1.5 font-medium transition-colors ${
        active
          ? "bg-[var(--crm-brand)] text-white"
          : "text-[var(--crm-muted)] hover:bg-gray-50 hover:text-[var(--crm-ink)]"
      }`}
    >
      {label}
    </Link>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "gold" | "green" | "blue" | "gray" }) {
  const styles = {
    gold: "border-[#d0aa45] bg-[#fff8dc] text-[#6f4d11]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
  }[tone]

  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
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

function formatSize(thickness: unknown, width: unknown, length: unknown, locale: string) {
  if (thickness == null || width == null || length == null) return "—"
  return `${Number(thickness).toLocaleString(locale)} × ${Number(width).toLocaleString(locale)} × ${Number(length).toLocaleString(locale)}`
}

function formatBaht(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatPlainMoney(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatQty(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    maximumFractionDigits: 3,
  })
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
