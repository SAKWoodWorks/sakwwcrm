import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/app/crm/products/ProductFilter", () => ({
  default: () => <div>Product filter</div>,
}))

import { prisma } from "@/lib/prisma"
import ProductsPage from "@/app/crm/products/page"

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 1,
        skuCode: "PINE-001",
        fullName: "Pine Board",
        category: "ไม้สน",
        grade: "A",
        thickness: 10,
        width: 100,
        length: 1000,
        wsCost: 100,
        rtCost: 120,
      },
    ] as Awaited<ReturnType<typeof prisma.product.findMany>>)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        product_id: 1,
        sku_code: "PINE-001",
        product_name: "Pine Board",
        description: null,
        sold_qty: 25,
        sold_amount: 50000,
        invoice_count: BigInt(3),
      },
    ])
  })

  it("renders monthly best-selling products", async () => {
    const jsx = await ProductsPage({ searchParams: Promise.resolve({ bestMonth: "5", bestYear: "2026" }) })
    render(jsx)

    expect(screen.getByText("สินค้าขายดีประจำเดือน")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "เดือน" })).toHaveValue("5")
    expect(screen.getByRole("combobox", { name: "ปี" })).toHaveValue("2026")
    expect(screen.getAllByText("Pine Board").length).toBeGreaterThan(0)
    expect(screen.getAllByText("฿50,000").length).toBeGreaterThan(0)
    expect(screen.getAllByText("PINE-001").length).toBeGreaterThan(0)
  })
})
