export const dynamic = "force-dynamic"

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
import { DEAL_STAGES, isDealStage } from "@/lib/deals"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import Link from "next/link"
import DealStageBadge from "./DealStageBadge"
import { formatSalespersonName } from "@/lib/salesperson-display"

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
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ดีล</h1>
          <p className="mt-1 text-sm text-gray-500">Pipeline งานขายก่อนออก invoice</p>
        </div>
        <Button asChild className="h-11 w-full bg-[var(--crm-brand)] font-bold text-white hover:bg-[var(--crm-brand-dark)] md:w-auto">
          <Link href="/crm/deals/new">สร้างดีล</Link>
        </Button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Open deals" value={String(openDeals.length)} />
        <MetricCard label="Pipeline value" value={formatMoney(pipelineValue)} />
        <MetricCard label="Weighted forecast" value={formatMoney(weightedForecast)} />
      </div>

      <form action="/crm/deals" className="mb-4 grid gap-3 md:flex md:flex-wrap">
        <Input
          name="q"
          defaultValue={q ?? ""}
          type="search"
          placeholder="ค้นหาชื่อดีลหรือลูกค้า..."
          className="h-11 bg-white md:w-72"
        />
        <Select name="stage" defaultValue={stage ?? "all"}>
          <SelectTrigger className="h-11 bg-white md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุก stage</SelectItem>
            {DEAL_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="salesperson" defaultValue={salesperson ?? "all"}>
          <SelectTrigger className="h-11 bg-white md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกพนักงาน</SelectItem>
            {salespersons.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {formatSalespersonName(s.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" className="h-11 border-[var(--crm-line)] bg-white font-bold text-[var(--crm-brand)] hover:bg-[var(--crm-brand-soft)]">
          กรอง
        </Button>
      </form>

      <div className="crm-mobile-list">
        {deals.map((deal) => {
          const value = Number(deal.expectedValue ?? 0)
          return (
            <Link key={deal.id} href={`/crm/deals/${deal.id}`}>
              <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 font-bold text-[var(--crm-ink)]">{deal.title}</h2>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">
                    {deal.customer?.name ?? "ไม่มีลูกค้า"}
                  </p>
                </div>
                <DealStageBadge stage={deal.stage} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">พนักงาน</p>
                  <p className="font-medium">{formatSalespersonName(deal.salesperson?.name)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">Expected close</p>
                  <p className="font-medium">{deal.expectedCloseDate ? deal.expectedCloseDate.toLocaleDateString("th-TH") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">มูลค่า</p>
                  <p className="font-semibold tabular-nums">{deal.expectedValue != null ? formatMoney(value) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--crm-muted)]">Weighted</p>
                  <p className="font-semibold tabular-nums">{deal.expectedValue != null ? formatMoney((value * deal.probability) / 100) : "—"}</p>
                </div>
              </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">ดีล</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">Stage</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ลูกค้า</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">พนักงาน</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">มูลค่า</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">Weighted</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">Expected close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  ยังไม่มีดีล
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => {
                const value = Number(deal.expectedValue ?? 0)
                return (
                  <TableRow key={deal.id} className="hover:bg-gray-50">
                    <TableCell className="px-4 py-3">
                      <Link href={`/crm/deals/${deal.id}`} className="font-medium text-blue-600 hover:underline">
                        {deal.title}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DealStageBadge stage={deal.stage} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {deal.customer ? (
                        <Link href={`/crm/customers/${deal.customer.id}`} className="text-blue-600 hover:underline">
                          {deal.customer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">{formatSalespersonName(deal.salesperson?.name)}</TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">
                      {deal.expectedValue != null ? formatMoney(value) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">
                      {deal.expectedValue != null ? formatMoney((value * deal.probability) / 100) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">
                      {deal.expectedCloseDate ? deal.expectedCloseDate.toLocaleDateString("th-TH") : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
    <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
        <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  )
}

function formatMoney(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}
