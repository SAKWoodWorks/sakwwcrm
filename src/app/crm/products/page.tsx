export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Suspense } from "react"
import ProductFilter from "./ProductFilter"

type Props = {
  searchParams: Promise<{ category?: string; bestMonth?: string; bestYear?: string }>
}

type TopProductRow = {
  product_id: number | null
  sku_code: string | null
  product_name: string | null
  description: string | null
  sold_qty: Prisma.Decimal | number
  sold_amount: Prisma.Decimal | number
  invoice_count: bigint
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category, bestMonth, bestYear } = await searchParams
  const selectedMonth = getSelectedMonth(bestMonth, bestYear)
  const monthStart = new Date(Date.UTC(selectedMonth.year, selectedMonth.month - 1, 1))
  const nextMonthStart = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 1))

  const where = category ? { category } : {}

  const [products, topProducts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { skuCode: "asc" }],
      select: {
        id: true,
        skuCode: true,
        fullName: true,
        category: true,
        grade: true,
        thickness: true,
        width: true,
        length: true,
        wsCost: true,
        rtCost: true,
      },
    }),
    prisma.$queryRaw<TopProductRow[]>`
      SELECT
        di.product_id,
        p.sku_code,
        p.full_name AS product_name,
        CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END AS description,
        COALESCE(SUM(di.quantity), 0) AS sold_qty,
        COALESCE(SUM(di.total), 0) AS sold_amount,
        COUNT(DISTINCT d.id) AS invoice_count
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      LEFT JOIN products p ON p.id = di.product_id
      WHERE d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
        AND d.doc_date >= ${monthStart}
        AND d.doc_date < ${nextMonthStart}
      GROUP BY di.product_id, p.sku_code, p.full_name, CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END
      ORDER BY sold_amount DESC
      LIMIT 10
    `,
  ])

  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">สินค้า</h1>
        <Suspense>
          <ProductFilter />
        </Suspense>
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--crm-ink)]">สินค้าขายดีประจำเดือน</h2>
            <p className="mt-1 text-sm text-[var(--crm-muted)]">เรียงจากยอดขาย TAX invoice ที่ชำระแล้วในเดือนนี้</p>
          </div>
          <BestProductMonthForm
            selectedMonth={selectedMonth.month}
            selectedYear={selectedMonth.year}
            category={category}
          />
        </div>
        <div className="crm-mobile-list">
          {topProducts.length === 0 ? (
            <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 text-center text-sm text-[var(--crm-muted)] shadow-[var(--crm-shadow)]">
              ไม่มีข้อมูลขายเดือนนี้
            </Card>
          ) : (
            topProducts.map((row, index) => (
              <Card key={`${row.product_id ?? "desc"}-${row.sku_code ?? row.description}-${index}`} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--crm-muted)]">#{index + 1}</p>
                    <h3 className="mt-1 line-clamp-2 font-semibold text-[var(--crm-ink)]">{topProductName(row)}</h3>
                    <p className="mt-1 font-mono text-xs text-[var(--crm-brand)]">{row.sku_code ?? "ไม่ผูก SKU"}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-bold tabular-nums text-[#7a5614]">{formatBaht(row.sold_amount)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">จำนวน</p>
                    <p className="font-semibold tabular-nums">{formatQty(row.sold_qty)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">Invoice</p>
                    <p className="font-semibold tabular-nums">{Number(row.invoice_count).toLocaleString("th-TH")}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        <div className="crm-table-wrap crm-desktop-table">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">#</TableHead>
                <TableHead className="px-4 py-3 text-gray-500">สินค้า</TableHead>
                <TableHead className="px-4 py-3 text-gray-500">SKU</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">จำนวน</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">Invoice</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">ยอดขาย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    ไม่มีข้อมูลขายเดือนนี้
                  </TableCell>
                </TableRow>
              ) : topProducts.map((row, index) => (
                <TableRow key={`${row.product_id ?? "desc"}-${row.sku_code ?? row.description}-${index}`} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 tabular-nums text-gray-400">{index + 1}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-gray-900">{topProductName(row)}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs text-gray-600">{row.sku_code ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{formatQty(row.sold_qty)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{Number(row.invoice_count).toLocaleString("th-TH")}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">{formatBaht(row.sold_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mb-2 text-sm text-gray-500">{products.length} รายการ</div>

      <div className="crm-mobile-list">
        {products.map((p) => (
          <Card key={p.id} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-[var(--crm-brand)]">{p.skuCode}</p>
                <h2 className="mt-1 line-clamp-2 font-semibold text-[var(--crm-ink)]">{p.fullName}</h2>
              </div>
              {p.category ? <CategoryBadge category={p.category} /> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-[var(--crm-muted)]">เกรด</p>
                <p className="font-medium">{p.grade ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">ขนาด</p>
                <p className="font-medium tabular-nums">{p.thickness && p.width && p.length ? `${p.thickness}×${p.width}×${p.length}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">ขายส่ง</p>
                <p className="font-semibold tabular-nums">{p.wsCost != null ? Number(p.wsCost).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">ขายปลีก</p>
                <p className="font-semibold tabular-nums">{p.rtCost != null ? Number(p.rtCost).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">SKU</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ชื่อสินค้า</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ประเภท</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">เกรด</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ขนาด (มม.)</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ราคาขายส่ง</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ราคาขายปลีก</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 font-mono text-xs text-gray-600">{p.skuCode}</TableCell>
                <TableCell className="px-4 py-3 text-gray-900">{p.fullName}</TableCell>
                <TableCell className="px-4 py-3">
                  {p.category ? <CategoryBadge category={p.category} /> : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{p.grade ?? "—"}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {p.thickness && p.width && p.length
                    ? `${p.thickness}×${p.width}×${p.length}`
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {p.wsCost != null
                    ? Number(p.wsCost).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {p.rtCost != null
                    ? Number(p.rtCost).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
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

function topProductName(row: TopProductRow) {
  return row.product_name ?? row.description ?? "ไม่ทราบสินค้า"
}

function formatBaht(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatQty(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString("th-TH", {
    maximumFractionDigits: 3,
  })
}

function BestProductMonthForm({
  selectedMonth,
  selectedYear,
  category,
}: {
  selectedMonth: number
  selectedYear: number
  category?: string
}) {
  const years = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 1 - index)

  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">เดือน</span>
        <select
          name="bestMonth"
          defaultValue={String(selectedMonth)}
          className="h-10 rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {formatMonthName(month)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">ปี</span>
        <select
          name="bestYear"
          defaultValue={String(selectedYear)}
          className="h-10 rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {(year + 543).toLocaleString("th-TH", { useGrouping: false })}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline" className="h-10">
        ดูเดือนนี้
      </Button>
    </form>
  )
}

function getSelectedMonth(monthParam?: string, yearParam?: string) {
  const today = new Date()
  const month = Number(monthParam)
  const year = Number(yearParam)

  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : today.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : today.getFullYear(),
  }
}

function formatMonthName(month: number) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString("th-TH", { month: "long" })
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    ไม้สน: "bg-green-100 text-green-800",
    ไม้ยาง: "bg-yellow-100 text-yellow-800",
    bamboo: "bg-lime-100 text-lime-800",
    osb: "bg-orange-100 text-orange-800",
    อื่นๆ: "bg-gray-100 text-gray-700",
  }
  const cls = map[category] ?? "bg-gray-100 text-gray-700"
  return (
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {category}
    </Badge>
  )
}

