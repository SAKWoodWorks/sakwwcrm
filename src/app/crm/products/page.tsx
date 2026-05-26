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
import { prisma } from "@/lib/prisma"
import { Suspense } from "react"
import ProductFilter from "./ProductFilter"

type Props = {
  searchParams: Promise<{ category?: string }>
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category } = await searchParams

  const where = category ? { category } : {}

  const products = await prisma.product.findMany({
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
  })

  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">สินค้า</h1>
        <Suspense>
          <ProductFilter />
        </Suspense>
      </div>

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

