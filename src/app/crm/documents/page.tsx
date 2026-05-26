export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { Suspense } from "react"
import DocumentFilters from "./DocumentFilters"
import { DocTypeBadge } from "./DocTypeBadge"
import PaymentToggle from "./PaymentToggle"
import type { Prisma } from "@prisma/client"
import { formatSalespersonName } from "@/lib/salesperson-display"

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

  const salespersonsQuery = prisma.salesperson.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const salespersonGroups = salesperson ? buildSalespersonGroups(await salespersonsQuery) : []
  const salespersonFilter = getSalespersonFilter(salesperson, salespersonGroups)

  const page = Math.max(1, parseInt(pageStr ?? "1") || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.DocumentWhereInput = {}
  if (type) where.docType = type
  if (status) where.paymentStatus = status
  if (channel) where.channel = channel
  if (salespersonFilter) where.salespersonId = salespersonFilter
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
    salesperson ? Promise.resolve([]) : salespersonsQuery,
  ])
  const filterSalespersonGroups = salesperson ? salespersonGroups : buildSalespersonGroups(salespersons)

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
    return `/crm/documents?${params.toString()}`
  }

  function indicator(sortKey: string) {
    if (sortField !== sortKey) return null
    return sortOrder === "desc" ? " ↓" : " ↑"
  }

  return (
    <div className="crm-page">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">เอกสาร</h1>
      </div>

      <div className="mb-4">
        <Suspense>
          <DocumentFilters salespersons={filterSalespersonGroups} />
        </Suspense>
      </div>

      <div className="crm-mobile-list">
        {documents.map((d) => (
          <Card key={d.id} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/crm/documents/${d.id}`} className="font-mono text-sm font-bold text-[var(--crm-brand)]">
                  {d.docNumber}
                </Link>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">{d.docDate.toLocaleDateString("th-TH")} · {d.channel ?? "—"}</p>
              </div>
              <DocTypeBadge docType={d.docType} />
            </div>
            <div className="mt-3">
              <p className="text-xs text-[var(--crm-muted)]">ลูกค้า</p>
              {d.customer ? (
                <Link href={`/crm/customers/${d.customer.id}`} className="line-clamp-2 font-semibold text-[var(--crm-ink)]">
                  {d.customer.name}
                </Link>
              ) : (
                <p className="font-semibold">—</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--crm-muted)]">พนักงาน</p>
                <p className="text-sm font-medium">{formatSalespersonName(d.salesperson?.name)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--crm-muted)]">ยอด</p>
                <p className="font-semibold tabular-nums">
                  {d.total != null
                    ? Number(d.total).toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 0 })
                    : "—"}
                </p>
              </div>
            </div>
            {d.docType === "tax_invoice" && (
              <div className="mt-3">
                <PaymentToggle documentId={d.id} currentStatus={d.paymentStatus} />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">
                <Link href={sortUrl("docDate")} className="hover:text-gray-800">
                  วันที่{indicator("docDate")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">เลขที่</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ประเภท</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ลูกค้า</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ช่องทาง</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">พนักงาน</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">
                <Link href={sortUrl("total")} className="hover:text-gray-800">
                  ยอด{indicator("total")}
                </Link>
              </TableHead>
              <TableHead className="px-4 py-3 text-gray-500">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/crm/documents/${d.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {d.docNumber}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <DocTypeBadge docType={d.docType} />
                </TableCell>
                <TableCell className="px-4 py-3">
                  {d.customer ? (
                    <Link href={`/crm/customers/${d.customer.id}`} className="text-blue-600 hover:underline">
                      {d.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</TableCell>
                <TableCell className="px-4 py-3">{formatSalespersonName(d.salesperson?.name)}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {d.total != null
                    ? Number(d.total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {d.docType === "tax_invoice" ? (
                    <PaymentToggle documentId={d.id} currentStatus={d.paymentStatus} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

function buildSalespersonGroups(salespersons: { id: number; name: string }[]) {
  const groups = new Map<string, number[]>()
  for (const salesperson of salespersons) {
    const label = formatSalespersonName(salesperson.name)
    groups.set(label, [...(groups.get(label) ?? []), salesperson.id])
  }

  return Array.from(groups.entries())
    .map(([label, ids]) => ({ value: label, label, ids }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function getSalespersonFilter(
  salesperson: string | undefined,
  groups: { value: string; ids: number[] }[]
): Prisma.DocumentWhereInput["salespersonId"] | null {
  if (!salesperson) return null

  const legacyId = parseInt(salesperson, 10)
  if (!isNaN(legacyId) && String(legacyId) === salesperson) return legacyId

  const group = groups.find((option) => option.value === salesperson)
  if (!group) return null
  return { in: group.ids }
}
