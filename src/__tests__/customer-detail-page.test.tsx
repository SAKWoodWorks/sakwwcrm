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

describe("CustomerDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
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
      documents: [],
    } as Awaited<ReturnType<typeof prisma.customer.findUnique>>)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
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
  })
})
