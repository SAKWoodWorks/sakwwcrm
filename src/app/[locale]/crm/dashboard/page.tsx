export const dynamic = "force-dynamic"

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
import { Link } from "@/i18n/navigation"
import { getLocale, getTranslations } from "next-intl/server"

interface Stats {
  total_customers: bigint
  monthly_revenue: Prisma.Decimal
  monthly_invoices: bigint
  lapsed_count: bigint
  pending_invoices: bigint
  new_customers: bigint
  monthly_quotations: bigint
  monthly_quotation_revenue: Prisma.Decimal
}

interface TopCustomer {
  id: number
  name: string
  lifetime_total: Prisma.Decimal
  last_purchase_date: Date
}

interface TopProduct {
  product_id: number | null
  sku_code: string | null
  product_name: string | null
  description: string | null
  sold_amount: Prisma.Decimal | number
  sold_qty: Prisma.Decimal | number
}

export default async function DashboardPage() {
  const [t, locale] = await Promise.all([getTranslations("Dashboard"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const selectedMonth = new Date()
  const bestProductsHref = `/crm/products?bestMonth=${selectedMonth.getMonth() + 1}&bestYear=${selectedMonth.getFullYear()}`
  const [[stats], topCustomers, topProducts] = await Promise.all([
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
           ))                                                                     AS lapsed_count,
        (SELECT COUNT(*)
         FROM documents
         WHERE doc_type = 'tax_invoice'
           AND payment_status = 'pending')                                        AS pending_invoices,
        (SELECT COUNT(*)
         FROM (
           SELECT customer_id, MIN(doc_date) AS first_invoice_date
           FROM documents
           WHERE doc_type = 'tax_invoice'
             AND customer_id IS NOT NULL
           GROUP BY customer_id
         ) first_purchase
         WHERE first_invoice_date >= date_trunc('month', CURRENT_DATE))          AS new_customers,
        (SELECT COUNT(*)
         FROM documents
         WHERE doc_type = 'quotation'
           AND doc_date >= date_trunc('month', CURRENT_DATE))                    AS monthly_quotations,
        (SELECT COALESCE(SUM(total), 0)
         FROM documents
         WHERE doc_type = 'quotation'
           AND doc_date >= date_trunc('month', CURRENT_DATE))                    AS monthly_quotation_revenue
    `,
    prisma.$queryRaw<TopCustomer[]>`
      SELECT
        c.id,
        c.name,
        COALESCE(SUM(d.total), 0) AS lifetime_total,
        MAX(d.doc_date)           AS last_purchase_date
      FROM customers c
      JOIN documents d ON d.customer_id = c.id
        AND d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
      GROUP BY c.id, c.name
      ORDER BY lifetime_total DESC
      LIMIT 10
    `,
    prisma.$queryRaw<TopProduct[]>`
      SELECT
        di.product_id,
        p.sku_code,
        p.full_name AS product_name,
        CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END AS description,
        COALESCE(SUM(di.total), 0) AS sold_amount,
        COALESCE(SUM(di.quantity), 0) AS sold_qty
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      LEFT JOIN products p ON p.id = di.product_id
      WHERE d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
        AND d.doc_date >= date_trunc('month', CURRENT_DATE)
        AND d.doc_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY di.product_id, p.sku_code, p.full_name, CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END
      ORDER BY sold_amount DESC
      LIMIT 5
    `,
  ])

  const fmt = (n: number) => n.toLocaleString(localeTag)
  const fmtBaht = (n: number) =>
    n.toLocaleString(localeTag, { style: "currency", currency: "THB", minimumFractionDigits: 0 })

  const cards = [
    {
      label: t("cards.totalCustomers"),
      value: fmt(Number(stats.total_customers)),
      href: "/crm/customers",
      color: "text-blue-700",
      border: "border-blue-100",
    },
    {
      label: t("cards.newCustomers"),
      value: fmt(Number(stats.new_customers)),
      href: "/crm/customers",
      color: "text-blue-500",
      border: "border-blue-100",
    },
    {
      label: t("cards.monthlyRevenue"),
      value: fmtBaht(Number(stats.monthly_revenue)),
      href: null,
      color: "text-green-700",
      border: "border-green-100",
    },
    {
      label: t("cards.monthlyInvoices"),
      value: fmt(Number(stats.monthly_invoices)),
      href: "/crm/documents?type=tax_invoice",
      color: "text-gray-800",
      border: "border-gray-100",
    },
    {
      label: t("cards.pendingInvoices"),
      value: fmt(Number(stats.pending_invoices)),
      href: "/crm/documents?type=tax_invoice",
      color: "text-orange-600",
      border: "border-orange-100",
    },
    {
      label: t("cards.lapsed"),
      value: fmt(Number(stats.lapsed_count)),
      href: "/crm/customers?lapsed=90",
      color: "text-red-600",
      border: "border-red-100",
    },
  ]

  return (
    <div className="crm-page">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => {
          const inner = (
            <Card
              className={`rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)] ${
                card.href ? "transition-shadow hover:shadow-md" : ""
              }`}
            >
              <CardContent className="p-4 md:p-5">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
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

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("bestProducts.title")}</h2>
        <Link href={bestProductsHref} className="text-sm text-blue-600 hover:underline">
          {t("bestProducts.viewAll")}
        </Link>
      </div>
      <div className="crm-table-wrap mt-3">
        <Table>
          <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">#</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("bestProducts.product")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("bestProducts.sku")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("bestProducts.quantity")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("bestProducts.sales")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  {t("bestProducts.empty")}
                </TableCell>
              </TableRow>
            ) : topProducts.map((product, index) => (
              <TableRow key={`${product.product_id ?? "desc"}-${product.sku_code ?? product.description}-${index}`} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 tabular-nums text-gray-400">{index + 1}</TableCell>
                <TableCell className="px-4 py-3 font-medium text-gray-900">{topProductName(product, t("bestProducts.unknownProduct"))}</TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs text-gray-600">{product.sku_code ?? "—"}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{formatQty(product.sold_qty, localeTag)}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">
                  {fmtBaht(Number(product.sold_amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Quotation vs Invoice */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("quotationInvoice.title")}</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("quotationInvoice.type")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("quotationInvoice.quantity")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("quotationInvoice.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-gray-50">
              <TableCell className="px-4 py-3 font-medium">
                <Link href="/crm/documents?type=quotation" className="text-blue-600 hover:underline">Quotation</Link>
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{fmt(Number(stats.monthly_quotations))}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{fmtBaht(Number(stats.monthly_quotation_revenue))}</TableCell>
            </TableRow>
            <TableRow className="hover:bg-gray-50">
              <TableCell className="px-4 py-3 font-medium">
                <Link href="/crm/documents?type=tax_invoice" className="text-blue-600 hover:underline">Invoice</Link>
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{fmt(Number(stats.monthly_invoices))}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-green-700">{fmtBaht(Number(stats.monthly_revenue))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Top customers */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("topCustomers.title")}</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">#</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("topCustomers.name")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("topCustomers.total")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("topCustomers.lastPurchase")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  {t("topCustomers.empty")}
                </TableCell>
              </TableRow>
            ) : topCustomers.map((c, i) => (
              <TableRow key={c.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 tabular-nums text-gray-400">{i + 1}</TableCell>
                <TableCell className="px-4 py-3">
                  <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums font-medium">
                  {Number(c.lifetime_total).toLocaleString(localeTag, {
                    style: "currency",
                    currency: "THB",
                    minimumFractionDigits: 0,
                  })}
                </TableCell>
                <TableCell className="px-4 py-3 tabular-nums text-gray-600">
                  {c.last_purchase_date
                    ? new Date(c.last_purchase_date).toLocaleDateString(localeTag)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function topProductName(row: TopProduct, fallback: string) {
  return row.product_name ?? row.description ?? fallback
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
