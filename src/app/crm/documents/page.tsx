export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Suspense } from "react"
import DocumentFilters from "./DocumentFilters"
import type { Prisma } from "@prisma/client"

type Props = {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    channel?: string
    salesperson?: string
    from?: string
    to?: string
    sort?: string
    order?: string
    page?: string
  }>
}

const PAGE_SIZE = 50

export default async function DocumentsPage({ searchParams }: Props) {
  const {
    q,
    type,
    status,
    channel,
    salesperson,
    from,
    to,
    sort = "docDate",
    order = "desc",
    page: pageStr,
  } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.DocumentWhereInput = {}
  if (type) where.docType = type
  if (status) where.paymentStatus = status
  if (channel) where.channel = channel
  if (salesperson) {
    const sid = parseInt(salesperson)
    if (!isNaN(sid)) where.salespersonId = sid
  }
  if (from || to) {
    where.docDate = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }
  if (q) {
    where.customer = { name: { contains: q, mode: "insensitive" } }
  }

  const validSorts = ["docDate", "total"] as const
  type SortField = (typeof validSorts)[number]
  const sortField: SortField = validSorts.includes(sort as SortField)
    ? (sort as SortField)
    : "docDate"
  const sortOrder = order === "asc" ? "asc" : "desc"

  const [documents, total, salespersons] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        docType: true,
        docNumber: true,
        docDate: true,
        channel: true,
        paymentStatus: true,
        total: true,
        customer: { select: { id: true, name: true } },
        salesperson: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function buildPageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (channel) params.set("channel", channel)
    if (salesperson) params.set("salesperson", salesperson)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("sort", sortField)
    params.set("order", sortOrder)
    params.set("page", String(p))
    return `/crm/documents?${params.toString()}`
  }

  function sortUrl(sortKey: string) {
    const newOrder = sortField === sortKey && sortOrder === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (channel) params.set("channel", channel)
    if (salesperson) params.set("salesperson", salesperson)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    params.set("sort", sortKey)
    params.set("order", newOrder)
    return `/crm/documents?${params}`
  }

  function indicator(sortKey: string) {
    if (sortField !== sortKey) return null
    return sortOrder === "desc" ? " ↓" : " ↑"
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">เอกสาร</h1>
      </div>

      <div className="mb-4">
        <Suspense>
          <DocumentFilters salespersons={salespersons} />
        </Suspense>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                <Link href={sortUrl("docDate")} className="hover:text-gray-800">
                  วันที่{indicator("docDate")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เลขที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ช่องทาง</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">พนักงาน</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                <Link href={sortUrl("total")} className="hover:text-gray-800">
                  ยอด{indicator("total")}
                </Link>
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{d.docNumber}</td>
                <td className="px-4 py-3">
                  <DocTypeBadge docType={d.docType} />
                </td>
                <td className="px-4 py-3">
                  {d.customer ? (
                    <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                      {d.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</td>
                <td className="px-4 py-3">{d.salesperson?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.total
                    ? Number(d.total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {d.docType === "tax_invoice" && d.paymentStatus === "paid" ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      ชำระแล้ว
                    </span>
                  ) : d.docType === "tax_invoice" ? (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      รอชำระ
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? "ไม่พบรายการ" : `แสดง ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} จาก ${total} รายการ`}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ถัดไป →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function DocTypeBadge({ docType }: { docType: string }) {
  if (docType === "tax_invoice")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">TAX Invoice</span>
  if (docType === "abb_invoice")
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Abb Invoice</span>
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Quotation</span>
}
