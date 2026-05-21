export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DocTypeBadge } from "@/app/crm/documents/DocTypeBadge"

type Props = {
  params: Promise<{ id: string }>
}

interface SpStats {
  id: number
  name: string
  line_user_id: string | null
  channel: string | null
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
  const spId = parseInt(id, 10)
  if (isNaN(spId)) notFound()

  const [statsRows, customers, documents] = await Promise.all([
    prisma.$queryRaw<SpStats[]>`
      SELECT
        s.id,
        s.name,
        s.line_user_id,
        s.channel,
        COUNT(DISTINCT c.id)                                                              AS customer_count,
        COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0)               AS total_revenue,
        COALESCE(SUM(d.total) FILTER (
          WHERE d.doc_type = 'tax_invoice'
          AND d.doc_date >= date_trunc('month', CURRENT_DATE)
        ), 0)                                                                             AS monthly_revenue,
        (
          SELECT COUNT(DISTINCT c2.id)
          FROM customers c2
          JOIN documents di ON di.customer_id = c2.id AND di.salesperson_id = s.id AND di.doc_type = 'tax_invoice'
          WHERE NOT EXISTS (
            SELECT 1 FROM documents di2
            WHERE di2.customer_id = c2.id
              AND di2.salesperson_id = s.id
              AND di2.doc_type = 'tax_invoice'
              AND di2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
          )
        )                                                                                 AS lapsed_count
      FROM salespersons s
      LEFT JOIN documents d ON d.salesperson_id = s.id
      LEFT JOIN customers c ON c.id = d.customer_id
      WHERE s.id = ${spId}
      GROUP BY s.id, s.name, s.line_user_id, s.channel
    `,
    prisma.$queryRaw<CustomerRow[]>`
      SELECT
        c.id,
        c.name,
        last_inv.doc_date  AS last_purchase_date,
        last_inv.total     AS last_purchase_total
      FROM customers c
      JOIN documents d ON d.customer_id = c.id AND d.salesperson_id = ${spId} AND d.doc_type = 'tax_invoice'
      LEFT JOIN LATERAL (
        SELECT doc_date, total
        FROM documents
        WHERE customer_id = c.id AND doc_type = 'tax_invoice' AND salesperson_id = ${spId}
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
        paymentStatus: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ])

  if (statsRows.length === 0) notFound()
  const sp = statsRows[0]

  const fmt = (n: unknown) =>
    Number(n).toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    })

  const kpis = [
    { label: "ลูกค้า", value: Number(sp.customer_count).toLocaleString("th-TH") },
    { label: "ยอดรวม", value: fmt(sp.total_revenue) },
    { label: "เดือนนี้", value: fmt(sp.monthly_revenue) },
    {
      label: "Lapsed >90 วัน",
      value: Number(sp.lapsed_count).toLocaleString("th-TH"),
      red: Number(sp.lapsed_count) > 0,
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <Link href="/crm/salespersons" className="text-sm text-blue-600 hover:underline">
          ← พนักงานขาย
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{sp.name}</h1>
        {sp.line_user_id ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            ✅ LINE ลงทะเบียนแล้ว
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            ยังไม่ลงทะเบียน LINE
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${k.red ? "text-red-600" : "text-gray-800"}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Customers table */}
      <h2 className="mb-3 text-lg font-semibold">ลูกค้า ({customers.length} รายการ)</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ซื้อล่าสุด</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดล่าสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  ไม่มีลูกค้า
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/crm/customers/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {c.last_purchase_date
                      ? c.last_purchase_date.toLocaleDateString("th-TH")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.last_purchase_total != null ? fmt(c.last_purchase_total) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent documents table */}
      <h2 className="mb-3 text-lg font-semibold">เอกสารล่าสุด ({documents.length} รายการ)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">วันที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เลขที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  ไม่มีเอกสาร
                </td>
              </tr>
            ) : (
              documents.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 tabular-nums">
                    {d.docDate.toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/crm/documents/${d.id}`} className="text-blue-600 hover:underline">
                      {d.docNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {d.customer ? (
                      <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                        {d.customer.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DocTypeBadge docType={d.docType} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {d.total != null ? fmt(d.total) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
