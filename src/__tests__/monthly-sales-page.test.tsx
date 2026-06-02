import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

import { prisma } from "@/lib/prisma"
import MonthlySalesPage from "@/app/crm/monthly-sales/page"

describe("MonthlySalesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        month_start: new Date("2026-05-01"),
        invoice_count: BigInt(12),
        customer_count: BigInt(8),
        total_paid: 1500000,
      },
      {
        month_start: new Date("2026-04-01"),
        invoice_count: BigInt(5),
        customer_count: BigInt(3),
        total_paid: 500000,
      },
    ])
  })

  it("renders monthly paid invoice totals for selected date range", async () => {
    const jsx = await MonthlySalesPage({
      searchParams: Promise.resolve({ from: "2026-04-01", to: "2026-05-31" }),
    })
    render(jsx)

    expect(screen.getByText("ยอดขายรายเดือน")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-04-01")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument()
    expect(screen.getByText("พฤษภาคม 2569")).toBeInTheDocument()
    expect(screen.getByText("เมษายน 2569")).toBeInTheDocument()
    expect(screen.getByText("฿2,000,000")).toBeInTheDocument()
    expect(screen.getByText("17")).toBeInTheDocument()
  })
})
