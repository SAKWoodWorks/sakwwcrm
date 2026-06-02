import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound")
  }),
}))

import { prisma } from "@/lib/prisma"
import CustomerDetailPage from "@/app/crm/customers/[id]/page"

const customerFixture = {
  id: 1080,
  name: "ยู พัซเซิล",
  taxId: null,
  vatRegistered: true,
  type: null,
  status: "active",
  province: "กรุงเทพมหานคร",
  address: null,
  phone: null,
  email: null,
  lineId: null,
  salesperson: null,
} as Awaited<ReturnType<typeof prisma.customer.findUnique>>

const documentStatsFixture = [
  {
    total_spend: 125000,
    last_purchase: new Date("2026-05-20"),
    salesperson_name: "Pickachu",
  },
]

const customerProductsFixture = [
  {
    product_id: 1,
    sku_code: "PINE-001",
    product_name: "Pine Board",
    description: null,
    total_qty: 25,
    total_amount: 50000,
    invoice_count: BigInt(3),
    last_purchase_date: new Date("2026-05-20"),
  },
]

const documentsFixture = [
  {
    id: 501,
    doc_type: "tax_invoice",
    doc_number: "TI-001",
    doc_date: new Date("2026-05-20"),
    channel: "LINE",
    payment_status: "paid",
    total: 125000,
    salesperson_name: "Pickachu",
  },
]

const documentCountFixture = [{ document_count: BigInt(1) }]

describe("CustomerDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customerFixture)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          purchase_rank: BigInt(12),
          total_paid: 1250000,
          total_invoices: BigInt(8),
        },
      ])
      .mockResolvedValueOnce(documentStatsFixture)
      .mockResolvedValueOnce(customerProductsFixture)
      .mockResolvedValueOnce(documentsFixture)
      .mockResolvedValueOnce(documentCountFixture)
      .mockResolvedValueOnce([
        {
          actor_email: "admin@sakww.com",
          created_at: new Date("2026-05-26T08:00:00.000Z"),
          metadata: { mergedIds: [1081, 1082] },
        },
      ])
  })

  it("renders merge history from audit logs", async () => {
    const jsx = await CustomerDetailPage({ params: Promise.resolve({ id: "1080" }) })
    render(jsx)

    expect(screen.getByText("ประวัติ merge")).toBeInTheDocument()
    expect(screen.getByText("รวม #1081, #1082 เข้า record นี้")).toBeInTheDocument()
    expect(screen.getByText("admin@sakww.com")).toBeInTheDocument()
    expect(screen.getByText("Top 100 #12")).toBeInTheDocument()
  })

  it("uses safe returnTo param for customer list link", async () => {
    const returnTo = "/crm/customers?sort=name&order=asc&page=3"
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "1080" }),
      searchParams: Promise.resolve({ returnTo }),
    })
    render(jsx)

    expect(screen.getByRole("link", { name: "← รายชื่อลูกค้า" })).toHaveAttribute("href", returnTo)
  })

  it("allows returning to top customer ranking", async () => {
    const returnTo = "/crm/top-customers?from=2026-01-01&to=2026-05-31&salesperson=Pickachu"
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "1080" }),
      searchParams: Promise.resolve({ returnTo }),
    })
    render(jsx)

    expect(screen.getByRole("link", { name: "← รายชื่อลูกค้า" })).toHaveAttribute("href", returnTo)
  })

  it("renders customer aliases inside a toggle", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce([
        { alias_name: "ยู พัซเซิล (สำนักงานใหญ่)", alias_type: "merged", tax_id: null, note: null },
        { alias_name: "U Puzzle Tax ID 0-7055-61001-12-8", alias_type: "merged", tax_id: null, note: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(documentStatsFixture)
      .mockResolvedValueOnce(customerProductsFixture)
      .mockResolvedValueOnce(documentsFixture)
      .mockResolvedValueOnce(documentCountFixture)
      .mockResolvedValueOnce([])

    const jsx = await CustomerDetailPage({ params: Promise.resolve({ id: "1080" }) })
    render(jsx)

    expect(screen.getByText("ชื่อเดิม / ชื่อที่ใช้ค้นหา (2)")).toBeInTheDocument()
    expect(screen.getByText("ยู พัซเซิล (สำนักงานใหญ่)")).toBeInTheDocument()
  })

  it("still renders customer detail when audit_logs table is missing", async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(customerFixture)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(documentStatsFixture)
      .mockResolvedValueOnce(customerProductsFixture)
      .mockResolvedValueOnce(documentsFixture)
      .mockResolvedValueOnce(documentCountFixture)
      .mockRejectedValueOnce({
        code: "P2010",
        meta: { code: "42P01", message: 'relation "audit_logs" does not exist' },
      })

    const jsx = await CustomerDetailPage({ params: Promise.resolve({ id: "1080" }) })
    render(jsx)

    expect(screen.getByText("ยู พัซเซิล")).toBeInTheDocument()
    expect(screen.queryByText("ประวัติ merge")).not.toBeInTheDocument()
  })

  it("renders document filters, sortable heads, and pagination", async () => {
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "1080" }),
      searchParams: Promise.resolve({ docType: "tax_invoice", docPageSize: "10", docPage: "2", docSort: "total_desc" }),
    })
    render(jsx)

    expect(screen.getByRole("combobox", { name: "ประเภทเอกสาร" })).toHaveValue("tax_invoice")
    expect(screen.getByRole("combobox", { name: "ต่อหน้า" })).toHaveValue("10")
    expect(screen.queryByRole("button", { name: "แสดง" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ยอด" })).toHaveAttribute(
      "href",
      "/crm/customers/1080?docType=tax_invoice&docPageSize=10&docSort=total_asc&docPage=1",
    )
    expect(screen.getByText("TI-001")).toBeInTheDocument()
  })

  it("renders products purchased by this customer", async () => {
    const jsx = await CustomerDetailPage({ params: Promise.resolve({ id: "1080" }) })
    render(jsx)

    expect(screen.getByText("สินค้าที่ลูกค้าซื้อ (1)")).toBeInTheDocument()
    expect(screen.getAllByText("Pine Board").length).toBeGreaterThan(0)
    expect(screen.getAllByText("1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("฿50,000").length).toBeGreaterThan(0)
  })
})
