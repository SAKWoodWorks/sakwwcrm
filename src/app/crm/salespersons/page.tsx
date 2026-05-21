export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"

interface SalespersonRow {
  id: number
  name: string
  line_user_id: string | null
  customer_count: bigint
  total_revenue: Prisma.Decimal | number
  lapsed_count: bigint
}

export default async function SalespersonsPage() {
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
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">พนักงานขาย</h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">LINE</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดรวม</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">lapsed &gt;90 วัน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const lapsed = Number(row.lapsed_count)
              const revenue = Number(row.total_revenue)
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/salespersons/${row.id}`} className="text-blue-600 hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.line_user_id ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        ✅ ลงทะเบียนแล้ว
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(row.customer_count)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {revenue.toLocaleString("th-TH", {
                      style: "currency",
                      currency: "THB",
                      minimumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {lapsed > 0 ? (
                      <span className="font-medium text-red-600">{lapsed}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        {rows.length} พนักงาน (แสดงเฉพาะที่มีลูกค้า)
      </p>
    </div>
  )
}
