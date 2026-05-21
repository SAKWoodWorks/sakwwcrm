export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"

interface Stats {
  total_customers: bigint
  monthly_revenue: Prisma.Decimal
  monthly_invoices: bigint
  lapsed_count: bigint
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
           ))                                                                     AS lapsed_count
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

  const cards = [
    {
      label: "ลูกค้าทั้งหมด",
      value: Number(stats.total_customers).toLocaleString("th-TH"),
      href: "/crm/customers",
      color: "text-blue-700",
      border: "border-blue-100",
    },
    {
      label: "ยอดขายเดือนนี้",
      value: Number(stats.monthly_revenue).toLocaleString("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 0,
      }),
      href: null,
      color: "text-green-700",
      border: "border-green-100",
    },
    {
      label: "Invoice เดือนนี้",
      value: Number(stats.monthly_invoices).toLocaleString("th-TH"),
      href: "/crm/documents?type=tax_invoice",
      color: "text-gray-800",
      border: "border-gray-100",
    },
    {
      label: "Lapsed >90 วัน",
      value: Number(stats.lapsed_count).toLocaleString("th-TH"),
      href: "/crm/customers?lapsed=1",
      color: "text-red-600",
      border: "border-red-100",
    },
  ]

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => {
          const inner = (
            <div
              className={`rounded-lg border ${card.border} bg-white p-5 ${card.href ? "hover:shadow-md transition-shadow" : ""}`}
            >
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </div>
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

      {/* Top customers */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Top 10 ลูกค้า (ยอดซื้อรวม)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดรวม</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ซื้อล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topCustomers.map((c, i) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 tabular-nums text-gray-400">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {Number(c.lifetime_total).toLocaleString("th-TH", {
                    style: "currency",
                    currency: "THB",
                    minimumFractionDigits: 0,
                  })}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {c.last_purchase_date
                    ? new Date(c.last_purchase_date).toLocaleDateString("th-TH")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
