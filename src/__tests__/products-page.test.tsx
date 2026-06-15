import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/app/[locale]/crm/products/ProductFilter", () => ({
  default: () => <div>Product filter</div>,
}))

vi.mock("@/app/[locale]/crm/products/ProductDeleteButton", () => ({
  default: () => <button type="button">Delete product</button>,
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const translations: Record<string, string> = {
  title: "สินค้า",
  count: "{count} รายการ",
  unknownProduct: "ไม่ทราบสินค้า",
  unlinkedSku: "ไม่ผูก SKU",
  editProduct: "แก้ไขสินค้า",
  "best.title": "สินค้าขายดีประจำเดือน",
  "best.description": "เรียงจากยอดขาย TAX invoice ที่ชำระแล้วในเดือนนี้",
  "best.empty": "ไม่มีข้อมูลขายเดือนนี้",
  "best.month": "เดือน",
  "best.year": "ปี",
  "best.submit": "ดูเดือนนี้",
  "table.product": "สินค้า",
  "table.productName": "ชื่อสินค้า",
  "table.sku": "SKU",
  "table.quantity": "จำนวน",
  "table.invoice": "Invoice",
  "table.amount": "ยอดขาย",
  "table.category": "ประเภท",
  "table.grade": "เกรด",
  "table.size": "ขนาด (มม.)",
  "table.wholesale": "ราคาขายส่ง",
  "table.retail": "ราคาขายปลีก",
  "table.actions": "จัดการ",
  "filter.pine": "ไม้สน",
  "filter.rubberwood": "ไม้ยาง",
  "filter.bamboo": "Bamboo",
  "filter.osb": "OSB",
  "filter.other": "อื่นๆ",
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "th"),
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, unknown>) => {
    const template = translations[key] ?? key
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      template,
    )
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[`filter.${key}`] ?? key,
}))

import { prisma } from "@/lib/prisma"
import ProductsPage from "@/app/[locale]/crm/products/page"

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
