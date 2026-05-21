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

export default async function DashboardPage() {
  const [stats] = await prisma.$queryRaw<Stats[]>`
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
  `

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
      href: "/crm/customers",
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
    </div>
  )
}
