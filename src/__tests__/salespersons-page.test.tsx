import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from "@/lib/prisma"
import SalespersonsPage from "@/app/crm/salespersons/page"

const mockRows = [
  {
    id: 8,
    name: "Pickachu",
    line_user_id: "U7e76ae55efbac1a1664fa49a3e877485",
    customer_count: BigInt(245),
    total_revenue: 1200000,
    lapsed_count: BigInt(12),
  },
  {
    id: 9,
    name: "Yaowalee",
    line_user_id: null,
    customer_count: BigInt(180),
    total_revenue: 890000,
    lapsed_count: BigInt(0),
  },
]

describe("SalespersonsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows)
  })

  it("renders salesperson names", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("Pickachu")).toBeInTheDocument()
    expect(screen.getByText("Yaowalee")).toBeInTheDocument()
  })

  it("shows LINE registered badge for registered salesperson", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("✅ ลงทะเบียนแล้ว")).toBeInTheDocument()
  })

  it("shows dash for unregistered LINE for unregistered salesperson", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    // Yaowalee is unregistered — LINE badge should not appear, only 1 registered badge exists
    const badges = screen.queryAllByText("✅ ลงทะเบียนแล้ว")
    expect(badges).toHaveLength(1)
  })

  it("renders customer count and lapsed count", async () => {
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("245")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("shows 0 salespersons when query returns empty", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const jsx = await SalespersonsPage()
    render(jsx)
    expect(screen.getByText("0 พนักงาน (แสดงเฉพาะที่มีลูกค้า)")).toBeInTheDocument()
  })
})
