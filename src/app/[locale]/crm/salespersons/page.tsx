export const dynamic = "force-dynamic"

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
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Link } from "@/i18n/navigation"
import { getLocale, getTranslations } from "next-intl/server"

interface SalespersonRow {
  id: number
  name: string
  line_user_id: string | null
  customer_count: bigint
  total_revenue: Prisma.Decimal | number
  lapsed_count: bigint
}

export default async function SalespersonsPage() {
  const [t, locale] = await Promise.all([getTranslations("Salespersons"), getLocale()])
  const localeTag = toLocaleTag(locale)
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
        JOIN documents di ON di.customer_id = c2.id AND di.salesperson_id = s.id AND di.doc_type = 'tax_invoice'
        WHERE NOT EXISTS (
          SELECT 1 FROM documents di2
          WHERE di2.customer_id = c2.id
            AND di2.doc_type = 'tax_invoice'
            AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
        )
      )                                                                       AS lapsed_count
    FROM salespersons s
    -- Join through documents since customers.salesperson_id is not populated by the import pipeline
    JOIN documents d ON d.salesperson_id = s.id
    JOIN customers c ON c.id = d.customer_id
    GROUP BY s.id, s.name, s.line_user_id
    ORDER BY
      (s.line_user_id IS NOT NULL) DESC,
      total_revenue DESC
  `

  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          <Link href="/crm/salespersons/new">{t("add")}</Link>
        </Button>
      </div>

      <div className="crm-mobile-list">
        {rows.map((row) => {
          const lapsed = Number(row.lapsed_count)
          const revenue = Number(row.total_revenue)
          return (
            <Card key={row.id} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
              <Link href={`/crm/salespersons/${row.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-[var(--crm-ink)]">{row.name}</h2>
                  {row.line_user_id ? (
                    <Badge variant="outline" className="border-[var(--crm-brand-soft)] bg-[var(--crm-brand-soft)] text-[var(--crm-brand-accent)]">
                      LINE
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">{t("table.customers")}</p>
                    <p className="font-semibold tabular-nums">{Number(row.customer_count).toLocaleString(localeTag)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">{t("table.total")}</p>
                    <p className="font-semibold tabular-nums">{revenue.toLocaleString(localeTag, { notation: "compact" })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">Lapsed</p>
                    <p className={lapsed > 0 ? "font-semibold text-[var(--crm-danger)]" : "font-semibold text-[var(--crm-muted)]"}>
                      {lapsed || "—"}
                    </p>
                  </div>
                </div>
              </Link>
            </Card>
          )
        })}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.name")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">LINE</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.customers")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.total")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.lapsed")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const lapsed = Number(row.lapsed_count)
              const revenue = Number(row.total_revenue)
              return (
                <TableRow key={row.id} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 font-medium">
                    <Link href={`/crm/salespersons/${row.id}`} className="text-blue-600 hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.line_user_id ? (
                      <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
                        {t("registered")}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {Number(row.customer_count).toLocaleString(localeTag)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {revenue.toLocaleString(localeTag, {
                      style: "currency",
                      currency: "THB",
                      minimumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {lapsed > 0 ? (
                      <span className="font-medium text-red-600">{lapsed.toLocaleString(localeTag)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {t("count", { count: rows.length.toLocaleString(localeTag) })}
      </p>
    </div>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
