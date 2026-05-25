export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { DEAL_STAGES, isDealStage } from "@/lib/deals"
import type { Prisma } from "@prisma/client"
import Link from "next/link"
import DealStageBadge from "./DealStageBadge"

type Props = {
  searchParams: Promise<{
    q?: string
    stage?: string
    salesperson?: string
    page?: string
  }>
}

const PAGE_SIZE = 50

export default async function DealsPage({ searchParams }: Props) {
  const { q, stage, salesperson, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.DealWhereInput = {}
  if (stage && isDealStage(stage)) where.stage = stage
  if (salesperson) {
    const salespersonId = parseInt(salesperson, 10)
    if (!isNaN(salespersonId) && String(salespersonId) === salesperson) {
      where.salespersonId = salespersonId
    }
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  const openWhere: Prisma.DealWhereInput = {
    ...where,
    stage: { notIn: ["won", "lost"] },
  }

  const [deals, total, salespersons, openDeals] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: [{ expectedCloseDate: "asc" }, { updatedAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true } },
        salesperson: { select: { name: true } },
      },
    }),
    prisma.deal.count({ where }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.deal.findMany({
      where: openWhere,
      select: { expectedValue: true, probability: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.expectedValue ?? 0), 0)
  const weightedForecast = openDeals.reduce(
    (sum, deal) => sum + (Number(deal.expectedValue ?? 0) * deal.probability) / 100,
    0
  )

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (stage) params.set("stage", stage)
    if (salesperson) params.set("salesperson", salesperson)
    params.set("page", String(p))
    return `/crm/deals?${params.toString()}`
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ดีล</h1>
          <p className="mt-1 text-sm text-gray-500">Pipeline งานขายก่อนออก invoice</p>
        </div>
        <Link
          href="/crm/deals/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          สร้างดีล
        </Link>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Open deals" value={String(openDeals.length)} />
        <MetricCard label="Pipeline value" value={formatMoney(pipelineValue)} />
        <MetricCard label="Weighted forecast" value={formatMoney(weightedForecast)} />
      </div>

      <form action="/crm/deals" className="mb-4 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          type="search"
          placeholder="ค้นหาชื่อดีลหรือลูกค้า..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          name="stage"
          defaultValue={stage ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">ทุก stage</option>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="salesperson"
          defaultValue={salesperson ?? ""}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">ทุกพนักงาน</option>
          {salespersons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          กรอง
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ดีล</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Stage</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ลูกค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">พนักงาน</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">มูลค่า</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Weighted</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Expected close</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  ยังไม่มีดีล
                </td>
              </tr>
            ) : (
              deals.map((deal) => {
                const value = Number(deal.expectedValue ?? 0)
                return (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/crm/deals/${deal.id}`} className="font-medium text-blue-600 hover:underline">
                        {deal.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <DealStageBadge stage={deal.stage} />
                    </td>
                    <td className="px-4 py-3">
                      {deal.customer ? (
                        <Link href={`/crm/customers/${deal.customer.id}`} className="text-blue-600 hover:underline">
                          {deal.customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{deal.salesperson?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {deal.expectedValue != null ? formatMoney(value) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {deal.expectedValue != null ? formatMoney((value * deal.probability) / 100) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {deal.expectedCloseDate ? deal.expectedCloseDate.toLocaleDateString("th-TH") : "—"}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? "ไม่พบรายการ" : `แสดง ${skip + 1}-${Math.min(skip + PAGE_SIZE, total)} จาก ${total} รายการ`}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="rounded border px-3 py-1 hover:bg-gray-100">
              ถัดไป
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function formatMoney(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}
