import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    salesperson: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import TopCustomersPage from "@/app/crm/top-customers/page"

const periodRows = [
  {
    customer_id: 2,
    customer_name: "May Period Buyer",
    phone_number: null,
    salesperson_names: "Pickachu + Jane",
    total_paid: 900000,
    total_invoices: BigInt(5),
    last_invoice_paid_date: new Date("2025-08-15"),
  },
]

describe("TopCustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue(periodRows)
    ;(prisma.salesperson.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 8, name: "Pickachu" },
      { id: 28, name: "Pickachu+Jane" },
      { id: 16, name: "Wanida" },
    ])
  })

  it("renders selected date range paid customer dashboard", async () => {
    const jsx = await TopCustomersPage({
      searchParams: Promise.resolve({ from: "2026-01-01", to: "2026-05-31" }),
    })
    render(jsx)

    expect(screen.getByText("Top 100 Customer Purchase Ranking")).toBeInTheDocument()
    expect(screen.getByText("ช่วงวันที่เลือก")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument()
    expect(screen.getAllByText("ทุกคน").length).toBeGreaterThan(0)
    expect(screen.getByText(/1 มกราคม 2569 ถึง 31 พฤษภาคม 2569/)).toBeInTheDocument()
  })

  it("renders required columns and paid invoice totals", async () => {
    const jsx = await TopCustomersPage()
    render(jsx)

    expect(screen.getAllByText("ลูกค้า").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Salesperson").length).toBeGreaterThan(0)
    expect(screen.getAllByText("เบอร์โทร").length).toBeGreaterThan(0)
    expect(screen.getAllByText("TotalPaid").length).toBeGreaterThan(0)
    expect(screen.getAllByText("TotalInvoices").length).toBeGreaterThan(0)
    expect(screen.getAllByText("LastInvoicePaidDate").length).toBeGreaterThan(0)
    expect(screen.getAllByText("May Period Buyer").length).toBeGreaterThan(0)
    expect(screen.getAllByText("15 สิงหาคม 2568").length).toBeGreaterThan(0)
    expect(screen.getAllByText("ไม่มีเบอร์โทร").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Pickachu").length).toBeGreaterThan(0)
  })
})
