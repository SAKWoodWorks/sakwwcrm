export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { notFound } from "next/navigation"
import { DocTypeBadge } from "@/app/[locale]/crm/documents/DocTypeBadge"
import SalespersonLineManage from "../SalespersonLineManage"

type Props = {
  params: Promise<{ id: string }>
}

interface SpStats {
  id: number
  name: string
  line_user_id: string | null
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
  const [t, locale] = await Promise.all([getTranslations("Salespersons"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const spId = parseInt(id, 10)
  if (isNaN(spId)) notFound()

  const [statsRows, customers, documents] = await Promise.all([
    prisma.$queryRaw<SpStats[]>`
      SELECT
        s.id,
        s.name,
        s.line_user_id,
        COUNT(DISTINCT c.id)                                                              AS customer_count,
        COALESCE(SUM(d.total) FILTER (WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')), 0)               AS total_revenue,
        COALESCE(SUM(d.total) FILTER (
          WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND d.doc_date >= date_trunc('month', CURRENT_DATE)
        ), 0)                                                                             AS monthly_revenue,
        (
          SELECT COUNT(DISTINCT c2.id)
          FROM customers c2
          JOIN documents di ON di.customer_id = c2.id AND di.salesperson_id = s.id AND di.doc_type IN ('tax_invoice', 'abb_invoice')
          WHERE NOT EXISTS (
            SELECT 1 FROM documents di2
            WHERE di2.customer_id = c2.id
              AND di2.salesperson_id = s.id
              AND di2.doc_type IN ('tax_invoice', 'abb_invoice')
              AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
          )
        )                                                                                 AS lapsed_count
      FROM salespersons s
      LEFT JOIN documents d ON d.salesperson_id = s.id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE s.id = ${spId}
      GROUP BY s.id, s.name, s.line_user_id
    `,
    prisma.$queryRaw<CustomerRow[]>`
      SELECT
        c.id,
        c.name,
        last_inv.doc_date  AS last_purchase_date,
        last_inv.total     AS last_purchase_total
      FROM customers c
      JOIN documents d ON d.customer_id = c.id AND d.salesperson_id = ${spId} AND d.doc_type IN ('tax_invoice', 'abb_invoice')
      LEFT JOIN LATERAL (
        SELECT doc_date, total
        FROM documents
        WHERE customer_id = c.id AND doc_type IN ('tax_invoice', 'abb_invoice') AND salesperson_id = ${spId}
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
        gdriveFilename: true,
        paymentStatus: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ])

  if (statsRows.length === 0) notFound()
  const sp = statsRows[0]

  const fmt = (n: unknown) =>
    Number(n).toLocaleString(localeTag, {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    })

  const kpis = [
    { label: t("table.customers"), value: Number(sp.customer_count).toLocaleString(localeTag) },
    { label: t("table.total"), value: fmt(sp.total_revenue) },
    { label: t("table.monthly"), value: fmt(sp.monthly_revenue) },
    {
      label: t("table.lapsed"),
      value: Number(sp.lapsed_count).toLocaleString(localeTag),
      red: Number(sp.lapsed_count) > 0,
    },
  ]

  return (
    <div className="crm-page max-w-5xl">
      <div className="mb-4">
        <Link href="/crm/salespersons" className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{sp.name}</h1>
          <SalespersonLineManage salespersonId={sp.id} lineUserId={sp.line_user_id} />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/crm/salespersons/${sp.id}/edit`}>{t("edit")}</Link>
        </Button>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`mt-1 text-lg font-bold tabular-nums ${k.red ? "text-red-600" : "text-gray-800"}`}>
                {k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customers table */}
      <h2 className="mb-3 text-lg font-semibold">{t("customersTitle", { count: customers.length.toLocaleString(localeTag) })}</h2>
      <div className="crm-table-wrap mb-8">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.name")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.lastPurchase")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.lastTotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  {t("emptyCustomers")}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3">
                    <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums text-gray-600">
                    {c.last_purchase_date
                      ? c.last_purchase_date.toLocaleDateString(localeTag)
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {c.last_purchase_total != null ? fmt(c.last_purchase_total) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Recent documents table */}
      <h2 className="mb-3 text-lg font-semibold">{t("recentDocumentsTitle", { count: documents.length.toLocaleString(localeTag) })}</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.date")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.number")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.customer")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.type")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  {t("emptyDocuments")}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((d) => (
                <TableRow key={d.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 tabular-nums">
                    {d.docDate.toLocaleDateString(localeTag)}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs">
                    <Link href={`/crm/documents/${d.id}`} className="text-blue-600 hover:underline">
                      {d.docNumber}
                    </Link>
                    {d.gdriveFilename && (
                      <div
                        className="mt-1 max-w-[22rem] truncate font-sans text-[11px] text-gray-500"
                        title={d.gdriveFilename}
                      >
                        {d.gdriveFilename}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {d.customer ? (
                      <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                        {d.customer.name}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <DocTypeBadge docType={d.docType} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {d.total != null ? fmt(d.total) : "—"}
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

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
