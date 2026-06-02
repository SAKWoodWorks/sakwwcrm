import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

import { prisma } from "@/lib/prisma"
import CustomerDuplicatesPage from "@/app/crm/customers/duplicates/page"

describe("CustomerDuplicatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockReset()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          group_key: "ยูพัซเซิล",
          customer_count: BigInt(3),
          customer_ids: [10, 11, 12],
          customer_names: ["ยู พัซเซิล", "ยู พัซเซิล (สำนักงานใหญ่)", "DFEX Co ,Ltd  ( Head office )"],
          tax_ids: ["-", "-", "-"],
          document_counts: [BigInt(3), BigInt(8), BigInt(1)],
        },
      ])
      .mockResolvedValueOnce([])
  })

  it("renders duplicate customer candidates with links", async () => {
    const jsx = await CustomerDuplicatesPage()
    render(jsx)

    expect(screen.getByText("ลูกค้าซ้ำ")).toBeInTheDocument()
    expect(screen.getByText("3 ลูกค้า")).toBeInTheDocument()
    expect(screen.getByText("1 กลุ่มซ้ำ")).toBeInTheDocument()
    expect(screen.getByText("ยูพัซเซิล")).toBeInTheDocument()
    expect(screen.getAllByText("1").length).toBeGreaterThan(0)
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ยู พัซเซิล" })).toHaveAttribute("href", "/crm/customers/10")
    expect(screen.getByRole("link", { name: "ยู พัซเซิล (สำนักงานใหญ่)" })).toHaveAttribute("href", "/crm/customers/11")
    expect(screen.getByRole("link", { name: "DFEX Co ,Ltd ( Head office )" })).toHaveAttribute("href", "/crm/customers/12")
    expect(screen.getByRole("link", { name: "เปิด #10" })).toHaveAttribute("href", "/crm/customers/10")
    expect(screen.getByRole("link", { name: "เปิด #11" })).toHaveAttribute("href", "/crm/customers/11")
    expect(screen.getByRole("button", { name: "ใช้ #10 เป็นลูกค้าหลัก" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ใช้ #11 เป็นลูกค้าหลัก" })).toBeInTheDocument()
    expect(screen.getByText("ถ้าใช้ #10 เป็นลูกค้าหลัก จะรวม #11, #12 เข้าไป")).toBeInTheDocument()
    expect(screen.getByText("ถ้าใช้ #11 เป็นลูกค้าหลัก จะรวม #10, #12 เข้าไป")).toBeInTheDocument()
    expect(screen.getByText("Manual merge")).toBeInTheDocument()
    expect(screen.getByLabelText("ลูกค้าหลัก ID")).toBeInTheDocument()
    expect(screen.getByLabelText("Duplicate IDs")).toBeInTheDocument()
  })

  it("renders duplicate customer groups by tax id", async () => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockReset()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          group_key: "0105555000000",
          customer_count: BigInt(2),
          customer_ids: [20, 21],
          customer_names: ["มาโฮม", "กิจมั่งมี"],
          tax_ids: ["0105555000000", "0105555000000"],
          document_counts: [BigInt(4), BigInt(9)],
        },
      ])

    const jsx = await CustomerDuplicatesPage()
    render(jsx)

    expect(screen.getAllByText("เลขภาษีซ้ำ").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0105555000000/).length).toBeGreaterThan(0)
    expect(screen.getByText("มาโฮม")).toBeInTheDocument()
    expect(screen.getByText("กิจมั่งมี")).toBeInTheDocument()
  })
})
