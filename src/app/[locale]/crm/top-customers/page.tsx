export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import DatePickerField from "@/components/DatePickerField"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/prisma"
import { formatSalespersonName } from "@/lib/salesperson-display"
import { Prisma } from "@prisma/client"
import { Link } from "@/i18n/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

interface PaidCustomerRow {
  customer_id: number
  customer_name: string
  phone_number: string | null
  salesperson_names: string | null
  total_paid: Prisma.Decimal | number
  total_paid_all: Prisma.Decimal | number
  total_invoices: bigint
  last_invoice_paid_date: Date
}

type RecencyTone = "green" | "yellow" | "orange" | "red"
type TopCustomerSearchParams = {
  from?: string
  to?: string
  salesperson?: string
  accountOfficer?: string
  sort?: string
}
type Props = {
  searchParams: Promise<TopCustomerSearchParams>
}

const DEFAULT_RANGE_MONTHS = 12
const SORT_OPTIONS = [
  { value: "total_paid_all_desc", orderBy: Prisma.sql`total_paid_all DESC` },
  { value: "total_paid_all_asc", orderBy: Prisma.sql`total_paid_all ASC` },
  { value: "total_paid_desc", orderBy: Prisma.sql`total_paid DESC` },
  { value: "total_paid_asc", orderBy: Prisma.sql`total_paid ASC` },
  { value: "invoice_count_desc", orderBy: Prisma.sql`total_invoices DESC` },
  { value: "last_paid_desc", orderBy: Prisma.sql`last_invoice_paid_date DESC` },
  { value: "customer_name_asc", orderBy: Prisma.sql`customer_name ASC` },
]

function monthsSince(date: Date, now = new Date()) {
  return (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()
}

function getRecencyTone(date: Date): RecencyTone {
  const months = monthsSince(new Date(date))
  if (months <= 3) return "green"
  if (months <= 6) return "yellow"
  if (months <= 12) return "orange"
  return "red"
}

const recencyStyles: Record<RecencyTone, { row: string; badge: string }> = {
  green: {
    row: "border-l-4 border-l-emerald-500",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
  },
  yellow: {
    row: "border-l-4 border-l-yellow-400",
    badge: "border-yellow-200 bg-yellow-100 text-yellow-800",
  },
  orange: {
    row: "border-l-4 border-l-orange-500",
    badge: "border-orange-200 bg-orange-100 text-orange-800",
  },
  red: {
    row: "border-l-4 border-l-red-600",
    badge: "border-red-200 bg-red-100 text-red-800",
  },
}

export default async function TopCustomersPage({
  searchParams,
}: Props = { searchParams: Promise.resolve({}) }) {
  const params = await searchParams
  const [t, locale] = await Promise.all([getTranslations("TopCustomers"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const range = getSelectedRange(params.from, params.to)
  const sortOption = SORT_OPTIONS.find((option) => option.value === params.sort) ?? SORT_OPTIONS[0]
  const selectedSalesperson = params.salesperson ?? params.accountOfficer
  const salespersonFilter = getSalespersonFilter(selectedSalesperson)
  const sortHrefs = {
    customerName: buildSortHref(params, "customer_name_asc"),
    totalPaid: buildSortHref(params, sortOption.value === "total_paid_desc" ? "total_paid_asc" : "total_paid_desc"),
    totalPaidAll: buildSortHref(
      params,
      sortOption.value === "total_paid_all_desc" ? "total_paid_all_asc" : "total_paid_all_desc",
    ),
    invoiceCount: buildSortHref(params, "invoice_count_desc"),
    lastPaid: buildSortHref(params, "last_paid_desc"),
  }
  const returnTo = buildCurrentHref(params)

  const [salespersons, rows] = await Promise.all([
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<PaidCustomerRow[]>`
      WITH period_docs AS (
        SELECT d.*
        FROM documents d
        LEFT JOIN salespersons sp ON sp.id = d.salesperson_id
        WHERE d.doc_type = 'tax_invoice'
          AND d.payment_status = 'paid'
          AND d.doc_date >= ${range.start}
          AND d.doc_date < ${range.endExclusive}
          ${salespersonFilter}
      ),
      all_paid AS (
        SELECT customer_id, COALESCE(SUM(total), 0) AS total_paid_all
        FROM documents
        WHERE doc_type = 'tax_invoice'
          AND payment_status = 'paid'
        GROUP BY customer_id
      )
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS phone_number,
        string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name) AS salesperson_names,
        COALESCE(SUM(pd.total), 0) AS total_paid,
        COALESCE(MAX(ap.total_paid_all), 0) AS total_paid_all,
        COUNT(pd.id) AS total_invoices,
        MAX(pd.doc_date) AS last_invoice_paid_date
      FROM customers c
      JOIN period_docs pd ON pd.customer_id = c.id
      LEFT JOIN salespersons sp ON sp.id = pd.salesperson_id
      LEFT JOIN all_paid ap ON ap.customer_id = c.id
      GROUP BY c.id, c.name, c.phone
      ORDER BY ${sortOption.orderBy}
      LIMIT 100
    `,
  ])
  const salespersonOptions = buildSalespersonOptions(salespersons)

  return (
    <div className="crm-page">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["green", "yellow", "orange", "red"] as RecencyTone[]).map((tone) => (
            <Badge key={tone} variant="outline" className={recencyStyles[tone].badge}>
              {recencyLabel(t, tone)}
            </Badge>
          ))}
        </div>
      </div>

      <DateRangeForm
        fromValue={range.fromValue}
        toValue={range.toValue}
        salespersonValue={selectedSalesperson ?? ""}
        salespersonOptions={salespersonOptions}
        labels={{
          from: t("dateForm.from"),
          to: t("dateForm.to"),
          salesperson: t("dateForm.salesperson"),
          all: t("dateForm.all"),
          none: t("dateForm.none"),
          submit: t("dateForm.submit"),
          summary: t("dateForm.summary", {
            from: formatDate(range.start, localeTag),
            to: formatDate(addDays(range.endExclusive, -1), localeTag),
          }),
        }}
      />
      <PaidCustomersTable
        title={t("selectedDateRange")}
        rows={rows}
        sortValue={sortOption.value}
        sortHrefs={sortHrefs}
        returnTo={returnTo}
        className="mt-4"
        locale={localeTag}
        labels={{
          count: t("count", { count: rows.length.toLocaleString(localeTag) }),
          empty: t("empty"),
          noPhone: t("noPhone"),
          unknownSalesperson: t("unknownSalesperson"),
          customer: t("table.customer"),
          salesperson: t("table.salesperson"),
          latestTotal: t("table.latestTotal"),
          allTotal: t("table.allTotal"),
          invoice: t("table.invoice"),
          lastPaid: t("table.lastPaid"),
          status: t("table.status"),
          totalInvoices: t("table.totalInvoices"),
          lastInvoicePaidDate: t("table.lastInvoicePaidDate"),
          recency: {
            green: t("recency.green"),
            greenShort: t("recency.greenShort"),
            yellow: t("recency.yellow"),
            yellowShort: t("recency.yellowShort"),
            orange: t("recency.orange"),
            orangeShort: t("recency.orangeShort"),
            red: t("recency.red"),
            redShort: t("recency.redShort"),
          },
        }}
      />
    </div>
  )
}

function DateRangeForm({
  fromValue,
  toValue,
  salespersonValue,
  salespersonOptions,
  labels,
}: {
  fromValue: string
  toValue: string
  salespersonValue: string
  salespersonOptions: { value: string; label: string }[]
  labels: {
    from: string
    to: string
    salesperson: string
    all: string
    none: string
    submit: string
    summary: string
  }
}) {
  return (
    <form method="get" className="mt-8">
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{labels.from}</span>
              <DatePickerField name="from" defaultValue={fromValue} placeholder={labels.from} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{labels.to}</span>
              <DatePickerField name="to" defaultValue={toValue} placeholder={labels.to} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{labels.salesperson}</span>
              <Select name="salesperson" defaultValue={salespersonValue || "all"}>
                <SelectTrigger className="h-11 w-full border-[var(--crm-line)] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{labels.all}</SelectItem>
                  <SelectItem value="__none__">{labels.none}</SelectItem>
                  {salespersonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

type TopCustomerLabels = {
  count: string
  empty: string
  noPhone: string
  unknownSalesperson: string
  customer: string
  salesperson: string
  latestTotal: string
  allTotal: string
  invoice: string
  lastPaid: string
  status: string
  totalInvoices: string
  lastInvoicePaidDate: string
  recency: Record<RecencyTone | `${RecencyTone}Short`, string>
}

function PaidCustomersTable({
  title,
  rows,
  sortValue,
  sortHrefs,
  returnTo,
  className = "",
  locale,
  labels,
}: {
  title: string
  rows: PaidCustomerRow[]
  sortValue: string
  sortHrefs: {
    customerName: string
    totalPaid: string
    totalPaidAll: string
    invoiceCount: string
    lastPaid: string
  }
  returnTo: string
  className?: string
  locale: string
  labels: TopCustomerLabels
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{title}</h2>
        <p className="text-sm text-[var(--crm-muted)]">{labels.count}</p>
      </div>

      <div className="crm-mobile-list">
        {rows.length === 0 ? (
          <Card className="rounded-lg border-[var(--crm-line)] bg-white text-center shadow-[var(--crm-shadow)]">
            <CardContent className="p-5 text-sm text-[var(--crm-muted)]">{labels.empty}</CardContent>
          </Card>
        ) : (
          rows.map((row, index) => <PaidCustomerCard key={row.customer_id} row={row} rank={index + 1} returnTo={returnTo} locale={locale} labels={labels} />)
        )}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table className="w-full table-fixed text-xs xl:text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[30%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-2 py-3 text-gray-500">#</TableHead>
              <TableHead className="px-2 py-3 text-gray-500">
                <SortLink href={sortHrefs.customerName} active={sortValue === "customer_name_asc"}>
                  {labels.customer}
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">{labels.salesperson}</TableHead>
              <TableHead className="px-2 py-3 text-right text-gray-500">
                <SortLink
                  href={sortHrefs.totalPaid}
                  active={sortValue === "total_paid_desc" || sortValue === "total_paid_asc"}
                >
                  {labels.latestTotal}
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-right text-gray-500">
                <SortLink
                  href={sortHrefs.totalPaidAll}
                  active={sortValue === "total_paid_all_desc" || sortValue === "total_paid_all_asc"}
                >
                  {labels.allTotal}
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-right text-gray-500">
                <SortLink href={sortHrefs.invoiceCount} active={sortValue === "invoice_count_desc"}>
                  {labels.invoice}
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">
                <SortLink href={sortHrefs.lastPaid} active={sortValue === "last_paid_desc"}>
                  {labels.lastPaid}
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">{labels.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  {labels.empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => {
                const tone = getRecencyTone(row.last_invoice_paid_date)
                return (
                  <TableRow key={row.customer_id} className={recencyStyles[tone].row}>
                    <TableCell className="px-2 py-3 tabular-nums text-gray-400">{index + 1}</TableCell>
                    <TableCell className="whitespace-normal px-2 py-3">
                      <Link href={buildCustomerDetailHref(row.customer_id, returnTo)} className="font-medium text-blue-600 hover:underline">
                        {row.customer_name}
                      </Link>
                      <div className="mt-1 truncate text-[11px] text-gray-400">{row.phone_number ?? labels.noPhone}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-3 text-gray-600">
                      {formatSalespersonList(row.salesperson_names, labels.unknownSalesperson)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right tabular-nums font-semibold text-[var(--crm-ink)]">
                      {formatBaht(row.total_paid, locale)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right tabular-nums font-semibold text-[#7a5614]">
                      {formatBaht(row.total_paid_all, locale)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right tabular-nums">{Number(row.total_invoices).toLocaleString(locale)}</TableCell>
                    <TableCell className="px-2 py-3 tabular-nums text-gray-600">{formatShortDate(row.last_invoice_paid_date, locale)}</TableCell>
                    <TableCell className="px-2 py-3">
                      <Badge variant="outline" className={recencyStyles[tone].badge}>
                        <span className="xl:hidden">{labels.recency[`${tone}Short`]}</span>
                        <span className="hidden xl:inline">{labels.recency[tone]}</span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
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

function buildSortHref(params: TopCustomerSearchParams, sort: string) {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)

  const salesperson = params.salesperson ?? params.accountOfficer
  if (salesperson && salesperson !== "all") query.set("salesperson", salesperson)
  if (sort !== "total_paid_all_desc") query.set("sort", sort)

  const queryString = query.toString()
  return queryString ? `/crm/top-customers?${queryString}` : "/crm/top-customers"
}

function buildCurrentHref(params: TopCustomerSearchParams) {
  const query = new URLSearchParams()
  if (params.from) query.set("from", params.from)
  if (params.to) query.set("to", params.to)

  const salesperson = params.salesperson ?? params.accountOfficer
  if (salesperson && salesperson !== "all") query.set("salesperson", salesperson)
  if (params.sort && params.sort !== "total_paid_all_desc") query.set("sort", params.sort)

  const queryString = query.toString()
  return queryString ? `/crm/top-customers?${queryString}` : "/crm/top-customers"
}

function buildCustomerDetailHref(customerId: number, returnTo: string) {
  return `/crm/customers/${customerId}?returnTo=${encodeURIComponent(returnTo)}`
}

function PaidCustomerCard({
  row,
  rank,
  returnTo,
  locale,
  labels,
}: {
  row: PaidCustomerRow
  rank: number
  returnTo: string
  locale: string
  labels: TopCustomerLabels
}) {
  const tone = getRecencyTone(row.last_invoice_paid_date)
  return (
    <Link href={buildCustomerDetailHref(row.customer_id, returnTo)}>
      <Card className={`block rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)] ${recencyStyles[tone].row}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--crm-muted)]">#{rank}</p>
            <h3 className="mt-1 line-clamp-2 text-base font-bold text-[var(--crm-ink)]">{row.customer_name}</h3>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">{formatSalespersonList(row.salesperson_names, labels.unknownSalesperson)} · {row.phone_number ?? labels.noPhone}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${recencyStyles[tone].badge}`}>
            {labels.recency[tone]}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--crm-muted)]">{labels.latestTotal}</p>
            <p className="font-semibold tabular-nums">{formatBaht(row.total_paid, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--crm-muted)]">{labels.allTotal}</p>
            <p className="font-semibold tabular-nums text-[#7a5614]">{formatBaht(row.total_paid_all, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--crm-muted)]">{labels.totalInvoices}</p>
            <p className="font-semibold tabular-nums">{Number(row.total_invoices).toLocaleString(locale)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--crm-muted)]">{labels.lastInvoicePaidDate}</p>
            <p className="font-semibold">{formatDate(row.last_invoice_paid_date, locale)}</p>
          </div>
        </div>
      </Card>
    </Link>
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

function formatShortDate(value: Date, locale: string) {
  return new Date(value).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function recencyLabel(t: Awaited<ReturnType<typeof getTranslations>>, tone: RecencyTone) {
  return t(`recency.${tone}`)
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

function buildSalespersonOptions(salespersons: { id: number; name: string }[]) {
  const groups = new Map<string, number[]>()
  for (const salesperson of salespersons) {
    const label = formatSalespersonName(salesperson.name)
    groups.set(label, [...(groups.get(label) ?? []), salesperson.id])
  }

  return Array.from(groups.entries())
    .map(([label, ids]) => ({ value: label, label, ids }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function getSalespersonFilter(value: string | undefined) {
  if (!value || value === "all") return Prisma.sql``
  if (value === "__none__") return Prisma.sql`AND d.salesperson_id IS NULL`

  return Prisma.sql`AND btrim(split_part(sp.name, '+', 1)) = ${value}`
}

function formatSalespersonList(names: string | null | undefined, fallback: string) {
  const formatted = (names ?? "")
    .split(",")
    .map((name) => formatSalespersonName(name))
    .filter((name, index, all) => all.indexOf(name) === index)

  return formatted.length > 0 ? formatted.join(", ") : fallback
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
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
