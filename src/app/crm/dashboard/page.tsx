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
import Link from "next/link"

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

export default async function DashboardPage() {
  const [[stats], topCustomers] = await Promise.all([
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
      JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
      GROUP BY c.id, c.name
      ORDER BY lifetime_total DESC
      LIMIT 10
    `,
  ])

  const fmt = (n: number) => n.toLocaleString("th-TH")
  const fmtBaht = (n: number) =>
    n.toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 })

  const cards = [
    {
      label: "ลูกค้าทั้งหมด",
      value: fmt(Number(stats.total_customers)),
      href: "/crm/customers",
      color: "text-blue-700",
      border: "border-blue-100",
    },
    {
      label: "ลูกค้าใหม่เดือนนี้",
      value: fmt(Number(stats.new_customers)),
      href: "/crm/customers",
      color: "text-blue-500",
      border: "border-blue-100",
    },
    {
      label: "ยอดขายเดือนนี้",
      value: fmtBaht(Number(stats.monthly_revenue)),
      href: null,
      color: "text-green-700",
      border: "border-green-100",
    },
    {
      label: "Invoice เดือนนี้",
      value: fmt(Number(stats.monthly_invoices)),
      href: "/crm/documents?type=tax_invoice",
      color: "text-gray-800",
      border: "border-gray-100",
    },
    {
      label: "Invoice ค้างชำระ",
      value: fmt(Number(stats.pending_invoices)),
      href: "/crm/documents?type=tax_invoice",
      color: "text-orange-600",
      border: "border-orange-100",
    },
    {
      label: "Lapsed >90 วัน",
      value: fmt(Number(stats.lapsed_count)),
      href: "/crm/customers?lapsed=90",
      color: "text-red-600",
      border: "border-red-100",
    },
  ]

  return (
    <div className="crm-page">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
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

      {/* Quotation vs Invoice */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Quotation vs Invoice เดือนนี้</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">ประเภท</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">จำนวน</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ยอดรวม</TableHead>
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
      <h2 className="mb-3 mt-8 text-lg font-semibold">Top 10 ลูกค้า (ยอดซื้อรวม)</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">#</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ชื่อ</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ยอดรวม</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ซื้อล่าสุด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  ไม่มีข้อมูล
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
                  {Number(c.lifetime_total).toLocaleString("th-TH", {
                    style: "currency",
                    currency: "THB",
                    minimumFractionDigits: 0,
                  })}
                </TableCell>
                <TableCell className="px-4 py-3 tabular-nums text-gray-600">
                  {c.last_purchase_date
                    ? new Date(c.last_purchase_date).toLocaleDateString("th-TH")
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
