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
import DatePickerField from "@/components/DatePickerField"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getLocale, getTranslations } from "next-intl/server"

type MonthlySalesSearchParams = {
  from?: string
  to?: string
}

type Props = {
  searchParams?: Promise<MonthlySalesSearchParams>
}

type MonthlySalesRow = {
  month_start: Date
  invoice_count: bigint
  customer_count: bigint
  total_paid: Prisma.Decimal | number
}

const DEFAULT_RANGE_MONTHS = 12

export default async function MonthlySalesPage({ searchParams }: Props = {}) {
  const params = searchParams ? await searchParams : {}
  const [t, locale] = await Promise.all([getTranslations("MonthlySales"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const range = getSelectedRange(params.from, params.to)

  const rows = await prisma.$queryRaw<MonthlySalesRow[]>`
    SELECT
      date_trunc('month', d.doc_date)::date AS month_start,
      COUNT(d.id) AS invoice_count,
      COUNT(DISTINCT d.customer_id) AS customer_count,
      COALESCE(SUM(d.total), 0) AS total_paid
    FROM documents d
    WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
      AND d.payment_status = 'paid'
      AND d.doc_date >= ${range.start}
      AND d.doc_date < ${range.endExclusive}
    GROUP BY month_start
    ORDER BY month_start DESC
  `

  const totalPaid = rows.reduce((sum, row) => sum + Number(row.total_paid ?? 0), 0)
  const totalInvoices = rows.reduce((sum, row) => sum + Number(row.invoice_count), 0)
  const avgMonthlyPaid = rows.length > 0 ? totalPaid / rows.length : 0

  return (
    <div className="crm-page">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            {t("description")}
          </p>
        </div>
      </div>

      <DateRangeForm
        fromValue={range.fromValue}
        toValue={range.toValue}
        labels={{
          from: t("filter.from"),
          to: t("filter.to"),
          submit: t("filter.submit"),
          summary: t("filter.summary", {
            from: formatDate(range.start, localeTag),
            to: formatDate(addDays(range.endExclusive, -1), localeTag),
          }),
        }}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label={t("metrics.total")} value={formatBaht(totalPaid, localeTag)} tone="gold" />
        <MetricCard label={t("metrics.invoiceCount")} value={totalInvoices.toLocaleString(localeTag)} tone="blue" />
        <MetricCard label={t("metrics.average")} value={formatBaht(avgMonthlyPaid, localeTag)} tone="green" />
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{t("table.title")}</h2>
          <p className="text-sm text-[var(--crm-muted)]">{t("table.count", { count: rows.length.toLocaleString(localeTag) })}</p>
        </div>
        <div className="crm-table-wrap">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">{t("table.month")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.total")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.invoice")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.customer")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    {t("table.empty")}
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.month_start.toISOString()} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 font-medium text-[var(--crm-ink)]">
                    {formatMonth(row.month_start, localeTag)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">
                    {formatBaht(row.total_paid, localeTag)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {Number(row.invoice_count).toLocaleString(localeTag)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {Number(row.customer_count).toLocaleString(localeTag)}
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

function DateRangeForm({
  fromValue,
  toValue,
  labels,
}: {
  fromValue: string
  toValue: string
  labels: {
    from: string
    to: string
    submit: string
    summary: string
  }
}) {
  return (
    <form method="get" className="mt-8">
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{labels.from}</span>
              <DatePickerField name="from" defaultValue={fromValue} placeholder={labels.from} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{labels.to}</span>
              <DatePickerField name="to" defaultValue={toValue} placeholder={labels.to} />
            </label>
            <Button type="submit" className="h-11 w-full bg-[var(--crm-brand)] font-bold text-white hover:bg-[var(--crm-brand-dark)] md:w-auto">
              {labels.submit}
            </Button>
          </div>
          <p className="text-xs text-[var(--crm-muted)]">{labels.summary}</p>
        </CardContent>
      </Card>
    </form>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "gold" | "blue" | "green" }) {
  const styles = {
    gold: "border-[#d0aa45] bg-[#fff8dc] text-[#6f4d11]",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone]

  return (
    <Card className={`rounded-lg shadow-[var(--crm-shadow)] ${styles}`}>
      <CardContent className="p-4">
        <p className="text-sm font-semibold opacity-75">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function formatBaht(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatDate(value: Date, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatMonth(value: Date, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  })
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}

function getSelectedRange(fromParam?: string, toParam?: string) {
  const today = new Date()
  const defaultTo = dateOnly(today)
  const defaultFrom = dateOnly(addMonths(today, -DEFAULT_RANGE_MONTHS))
  const fromValue = parseDateInput(fromParam) ?? defaultFrom
  const toValue = parseDateInput(toParam) ?? defaultTo
  const normalizedFrom = fromValue <= toValue ? fromValue : toValue
  const normalizedTo = fromValue <= toValue ? toValue : fromValue

  return {
    fromValue: normalizedFrom,
    toValue: normalizedTo,
    start: new Date(`${normalizedFrom}T00:00:00.000Z`),
    endExclusive: addDays(new Date(`${normalizedTo}T00:00:00.000Z`), 1),
  }
}

function parseDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : value
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}
