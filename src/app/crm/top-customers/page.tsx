export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import Link from "next/link"
import type { ReactNode } from "react"

interface PaidCustomerRow {
  customer_id: number
  customer_name: string
  phone_number: string | null
  salesperson_names: string | null
  total_paid: Prisma.Decimal | number
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
  { value: "total_paid_desc", label: "ยอดซื้อรวมมากไปน้อย", orderBy: Prisma.sql`total_paid DESC` },
  { value: "total_paid_asc", label: "ยอดซื้อรวมน้อยไปมาก", orderBy: Prisma.sql`total_paid ASC` },
  { value: "invoice_count_desc", label: "จำนวน invoice มากไปน้อย", orderBy: Prisma.sql`total_invoices DESC` },
  { value: "last_paid_desc", label: "วันที่ซื้อล่าสุด", orderBy: Prisma.sql`last_invoice_paid_date DESC` },
  { value: "customer_name_asc", label: "ชื่อลูกค้า", orderBy: Prisma.sql`customer_name ASC` },
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

const recencyStyles: Record<RecencyTone, { row: string; badge: string; label: string; compactLabel: string }> = {
  green: {
    row: "border-l-4 border-l-emerald-500",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    label: "ใน 3 เดือน",
    compactLabel: "3ด.",
  },
  yellow: {
    row: "border-l-4 border-l-yellow-400",
    badge: "border-yellow-200 bg-yellow-100 text-yellow-800",
    label: "ใน 6 เดือน",
    compactLabel: "6ด.",
  },
  orange: {
    row: "border-l-4 border-l-orange-500",
    badge: "border-orange-200 bg-orange-100 text-orange-800",
    label: "ใน 12 เดือน",
    compactLabel: "12ด.",
  },
  red: {
    row: "border-l-4 border-l-red-600",
    badge: "border-red-200 bg-red-100 text-red-800",
    label: "เกิน 12 เดือน",
    compactLabel: ">12ด.",
  },
}

export default async function TopCustomersPage({
  searchParams,
}: Props = { searchParams: Promise.resolve({}) }) {
  const params = await searchParams
  const range = getSelectedRange(params.from, params.to)
  const sortOption = SORT_OPTIONS.find((option) => option.value === params.sort) ?? SORT_OPTIONS[0]
  const selectedSalesperson = params.salesperson ?? params.accountOfficer
  const salespersonFilter = getSalespersonFilter(selectedSalesperson)
  const sortHrefs = {
    customerName: buildSortHref(params, "customer_name_asc"),
    totalPaid: buildSortHref(params, sortOption.value === "total_paid_desc" ? "total_paid_asc" : "total_paid_desc"),
    invoiceCount: buildSortHref(params, "invoice_count_desc"),
    lastPaid: buildSortHref(params, "last_paid_desc"),
  }

  const [salespersons, rows] = await Promise.all([
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<PaidCustomerRow[]>`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone AS phone_number,
        string_agg(DISTINCT sp.name, ', ' ORDER BY sp.name) AS salesperson_names,
        COALESCE(SUM(d.total), 0) AS total_paid,
        COUNT(d.id) AS total_invoices,
        MAX(d.doc_date) AS last_invoice_paid_date
      FROM customers c
      JOIN documents d ON d.customer_id = c.id
      LEFT JOIN salespersons sp ON sp.id = d.salesperson_id
      WHERE d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
        AND d.doc_date >= ${range.start}
        AND d.doc_date < ${range.endExclusive}
        ${salespersonFilter}
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
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">Top 100 Customer Purchase Ranking</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            จัดอันดับจากยอดรวมของ tax invoice ที่ชำระแล้วเท่านั้น
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(["green", "yellow", "orange", "red"] as RecencyTone[]).map((tone) => (
            <Badge key={tone} variant="outline" className={recencyStyles[tone].badge}>
              {recencyStyles[tone].label}
            </Badge>
          ))}
        </div>
      </div>

      <DateRangeForm
        fromValue={range.fromValue}
        toValue={range.toValue}
        fromLabel={formatThaiDate(range.start)}
        toLabel={formatThaiDate(addDays(range.endExclusive, -1))}
        salespersonValue={selectedSalesperson ?? ""}
        salespersonOptions={salespersonOptions}
      />
      <PaidCustomersTable
        title="ช่วงวันที่เลือก"
        rows={rows}
        sortValue={sortOption.value}
        sortHrefs={sortHrefs}
        className="mt-4"
      />
    </div>
  )
}

function DateRangeForm({
  fromValue,
  toValue,
  fromLabel,
  toLabel,
  salespersonValue,
  salespersonOptions,
}: {
  fromValue: string
  toValue: string
  fromLabel: string
  toLabel: string
  salespersonValue: string
  salespersonOptions: { value: string; label: string }[]
}) {
  return (
    <form method="get" className="mt-8">
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">จากวันที่</span>
              <Input type="date" name="from" defaultValue={fromValue} className="h-11 border-[var(--crm-line)] bg-white" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ถึงวันที่</span>
              <Input type="date" name="to" defaultValue={toValue} className="h-11 border-[var(--crm-line)] bg-white" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">Salesperson</span>
              <Select name="salesperson" defaultValue={salespersonValue || "all"}>
                <SelectTrigger className="h-11 w-full border-[var(--crm-line)] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกคน</SelectItem>
                  <SelectItem value="__none__">ไม่มีชื่อพนักงาน</SelectItem>
                  {salespersonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button type="submit" className="h-11 w-full bg-[var(--crm-brand)] font-bold text-white hover:bg-[var(--crm-brand-dark)] md:w-auto">
              ดูช่วงนี้
            </Button>
          </div>
          <p className="text-xs text-[var(--crm-muted)]">
            ตารางด้านล่างจัดอันดับจาก invoice ที่ชำระแล้วภายในช่วง {fromLabel} ถึง {toLabel}
          </p>
        </CardContent>
      </Card>
    </form>
  )
}

function PaidCustomersTable({
  title,
  rows,
  sortValue,
  sortHrefs,
  className = "",
}: {
  title: string
  rows: PaidCustomerRow[]
  sortValue: string
  sortHrefs: {
    customerName: string
    totalPaid: string
    invoiceCount: string
    lastPaid: string
  }
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{title}</h2>
        <p className="text-sm text-[var(--crm-muted)]">{rows.length} รายการ</p>
      </div>

      <div className="crm-mobile-list">
        {rows.length === 0 ? (
          <Card className="rounded-lg border-[var(--crm-line)] bg-white text-center shadow-[var(--crm-shadow)]">
            <CardContent className="p-5 text-sm text-[var(--crm-muted)]">ไม่มีข้อมูล</CardContent>
          </Card>
        ) : (
          rows.map((row, index) => <PaidCustomerCard key={row.customer_id} row={row} rank={index + 1} />)
        )}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table className="w-full table-fixed text-xs xl:text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[36%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-2 py-3 text-gray-500">#</TableHead>
              <TableHead className="px-2 py-3 text-gray-500">
                <SortLink href={sortHrefs.customerName} active={sortValue === "customer_name_asc"}>
                  ลูกค้า
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">Salesperson</TableHead>
              <TableHead className="px-2 py-3 text-right text-gray-500">
                <SortLink
                  href={sortHrefs.totalPaid}
                  active={sortValue === "total_paid_desc" || sortValue === "total_paid_asc"}
                >
                  ยอดซื้อ
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-right text-gray-500">
                <SortLink href={sortHrefs.invoiceCount} active={sortValue === "invoice_count_desc"}>
                  Inv.
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">
                <SortLink href={sortHrefs.lastPaid} active={sortValue === "last_paid_desc"}>
                  ซื้อล่าสุด
                </SortLink>
              </TableHead>
              <TableHead className="px-2 py-3 text-gray-500">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  ไม่มีข้อมูล
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => {
                const tone = getRecencyTone(row.last_invoice_paid_date)
                return (
                  <TableRow key={row.customer_id} className={recencyStyles[tone].row}>
                    <TableCell className="px-2 py-3 tabular-nums text-gray-400">{index + 1}</TableCell>
                    <TableCell className="whitespace-normal px-2 py-3">
                      <Link href={`/crm/customers/${row.customer_id}`} className="font-medium text-blue-600 hover:underline">
                        {row.customer_name}
                      </Link>
                      <div className="mt-1 truncate text-[11px] text-gray-400">{row.phone_number ?? "ไม่มีเบอร์โทร"}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-3 text-gray-600">
                      {formatSalespersonList(row.salesperson_names)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right tabular-nums font-semibold text-[var(--crm-ink)]">
                      {formatBaht(row.total_paid)}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right tabular-nums">{Number(row.total_invoices).toLocaleString("th-TH")}</TableCell>
                    <TableCell className="px-2 py-3 tabular-nums text-gray-600">{formatThaiShortDate(row.last_invoice_paid_date)}</TableCell>
                    <TableCell className="px-2 py-3">
                      <Badge variant="outline" className={recencyStyles[tone].badge}>
                        <span className="xl:hidden">{recencyStyles[tone].compactLabel}</span>
                        <span className="hidden xl:inline">{recencyStyles[tone].label}</span>
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
  if (sort !== "total_paid_desc") query.set("sort", sort)

  const queryString = query.toString()
  return queryString ? `/crm/top-customers?${queryString}` : "/crm/top-customers"
}

function PaidCustomerCard({ row, rank }: { row: PaidCustomerRow; rank: number }) {
  const tone = getRecencyTone(row.last_invoice_paid_date)
  return (
    <Link href={`/crm/customers/${row.customer_id}`}>
      <Card className={`block rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)] ${recencyStyles[tone].row}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--crm-muted)]">#{rank}</p>
            <h3 className="mt-1 line-clamp-2 text-base font-bold text-[var(--crm-ink)]">{row.customer_name}</h3>
            <p className="mt-1 text-xs text-[var(--crm-muted)]">{formatSalespersonList(row.salesperson_names)} · {row.phone_number ?? "ไม่มีเบอร์โทร"}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${recencyStyles[tone].badge}`}>
            {recencyStyles[tone].label}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-[var(--crm-muted)]">TotalPaid</p>
            <p className="font-semibold tabular-nums">{formatBaht(row.total_paid)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--crm-muted)]">TotalInvoices</p>
            <p className="font-semibold tabular-nums">{Number(row.total_invoices).toLocaleString("th-TH")}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--crm-muted)]">LastInvoicePaidDate</p>
            <p className="font-semibold">{formatThaiDate(row.last_invoice_paid_date)}</p>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function formatBaht(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatThaiDate(value: Date) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatThaiShortDate(value: Date) {
  return new Date(value).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
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

function formatSalespersonList(names?: string | null) {
  const formatted = (names ?? "")
    .split(",")
    .map((name) => formatSalespersonName(name))
    .filter((name, index, all) => all.indexOf(name) === index)

  return formatted.length > 0 ? formatted.join(", ") : formatSalespersonName(null)
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
