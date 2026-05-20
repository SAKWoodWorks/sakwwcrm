export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Suspense } from "react"
import CustomerSearch from "./CustomerSearch"

type Props = {
  searchParams: Promise<{ q?: string; page?: string }>
}

const PAGE_SIZE = 50

export default async function CustomersPage({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { taxId: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        taxId: true,
        province: true,
        type: true,
        status: true,
        salesperson: { select: { name: true } },
        documents: {
          where: { docType: "tax_invoice" },
          orderBy: { docDate: "desc" },
          take: 1,
          select: { docDate: true, total: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ลูกค้า</h1>
        <Suspense>
          <CustomerSearch />
        </Suspense>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">TAX ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">จังหวัด</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">สถานะ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ซื้อล่าสุด</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดล่าสุด</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">PM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c) => {
              const lastDoc = c.documents[0]
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/customers/${c.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.taxId ?? "—"}</td>
                  <td className="px-4 py-3">{c.province ?? "—"}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={c.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {lastDoc
                      ? lastDoc.docDate.toLocaleDateString("th-TH")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {lastDoc?.total
                      ? Number(lastDoc.total).toLocaleString("th-TH", {
                          style: "currency",
                          currency: "THB",
                          minimumFractionDigits: 0,
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.salesperson?.name ?? "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? "ไม่พบรายการ" : `แสดง ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} จาก ${total} รายการ`}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/crm/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}
              className="rounded border px-3 py-1 hover:bg-gray-100"
            >
              ถัดไป →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string | null }) {
  const map: Record<string, string> = {
    retail: "bg-green-100 text-green-800",
    dealer: "bg-blue-100 text-blue-800",
    lazada: "bg-orange-100 text-orange-800",
    thai_watsadu: "bg-purple-100 text-purple-800",
  }
  const cls = (type && map[type]) ?? "bg-gray-100 text-gray-800"
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {type ?? "ไม่ระบุ"}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    not_purchase_yet: "bg-gray-100 text-gray-600",
    active: "bg-yellow-100 text-yellow-800",
    repeat: "bg-green-100 text-green-800",
  }
  const label: Record<string, string> = {
    not_purchase_yet: "ยังไม่ซื้อ",
    active: "Active",
    repeat: "Repeat",
  }
  const cls = map[status] ?? "bg-gray-100 text-gray-600"
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}
