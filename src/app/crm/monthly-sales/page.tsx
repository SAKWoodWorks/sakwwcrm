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
  const range = getSelectedRange(params.from, params.to)

  const rows = await prisma.$queryRaw<MonthlySalesRow[]>`
    SELECT
      date_trunc('month', d.doc_date)::date AS month_start,
      COUNT(d.id) AS invoice_count,
      COUNT(DISTINCT d.customer_id) AS customer_count,
      COALESCE(SUM(d.total), 0) AS total_paid
    FROM documents d
    WHERE d.doc_type = 'tax_invoice'
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
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">ยอดขายรายเดือน</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            สรุปยอดจาก TAX invoice ที่ชำระแล้ว แยกตามเดือน
          </p>
        </div>
      </div>

      <DateRangeForm
        fromValue={range.fromValue}
        toValue={range.toValue}
        fromLabel={formatThaiDate(range.start)}
        toLabel={formatThaiDate(addDays(range.endExclusive, -1))}
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="ยอดรวม" value={formatBaht(totalPaid)} tone="gold" />
        <MetricCard label="จำนวน Invoice" value={totalInvoices.toLocaleString("th-TH")} tone="blue" />
        <MetricCard label="เฉลี่ยต่อเดือน" value={formatBaht(avgMonthlyPaid)} tone="green" />
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--crm-ink)]">รายเดือน</h2>
          <p className="text-sm text-[var(--crm-muted)]">{rows.length.toLocaleString("th-TH")} เดือน</p>
        </div>
        <div className="crm-table-wrap">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">เดือน</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">ยอดรวม</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">Invoice</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">ลูกค้า</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    ไม่มีข้อมูลในช่วงวันที่นี้
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.month_start.toISOString()} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 font-medium text-[var(--crm-ink)]">
                    {formatThaiMonth(row.month_start)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">
                    {formatBaht(row.total_paid)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {Number(row.invoice_count).toLocaleString("th-TH")}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {Number(row.customer_count).toLocaleString("th-TH")}
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
  fromLabel,
  toLabel,
}: {
  fromValue: string
  toValue: string
  fromLabel: string
  toLabel: string
}) {
  return (
    <form method="get" className="mt-8">
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="grid gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">จากวันที่</span>
              <DatePickerField name="from" defaultValue={fromValue} placeholder="จากวันที่" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ถึงวันที่</span>
              <DatePickerField name="to" defaultValue={toValue} placeholder="ถึงวันที่" />
            </label>
            <Button type="submit" className="h-11 w-full bg-[var(--crm-brand)] font-bold text-white hover:bg-[var(--crm-brand-dark)] md:w-auto">
              ดูช่วงนี้
            </Button>
          </div>
          <p className="text-xs text-[var(--crm-muted)]">
            แสดงยอดตั้งแต่ {fromLabel} ถึง {toLabel}
          </p>
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

function formatThaiMonth(value: Date) {
  return new Date(value).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
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
