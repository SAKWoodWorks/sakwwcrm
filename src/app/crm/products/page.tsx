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
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">สินค้า</h1>
        <Suspense>
          <ProductFilter />
        </Suspense>
      </div>

      <div className="mb-2 text-sm text-gray-500">{products.length} รายการ</div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อสินค้า</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เกรด</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ขนาด (มม.)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ราคาขายส่ง</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ราคาขายปลีก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.skuCode}</td>
                <td className="px-4 py-3 text-gray-900">{p.fullName}</td>
                <td className="px-4 py-3">
                  {p.category ? <CategoryBadge category={p.category} /> : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.grade ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {p.thickness && p.width && p.length
                    ? `${p.thickness}×${p.width}×${p.length}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.wsCost
                    ? Number(p.wsCost).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {p.rtCost
                    ? Number(p.rtCost).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {category}
    </span>
  )
}


