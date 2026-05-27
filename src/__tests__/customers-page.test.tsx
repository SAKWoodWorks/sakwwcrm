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
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

import { prisma } from "@/lib/prisma"
import CustomersPage from "@/app/crm/customers/page"

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockReset()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "บริษัท ตัวอย่าง จำกัด",
          tax_id: "0100000000000",
          province: "กรุงเทพมหานคร",
          type: "dealer",
          status: "active",
          salesperson_name: "Pickachu + Jane",
          alias_names: null,
          last_purchase_date: new Date("2026-05-01"),
          last_purchase_total: 12000,
        },
      ])
  })

  it("labels customer salesperson column as Salesperson instead of PM", async () => {
    const jsx = await CustomersPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getAllByText("Salesperson").length).toBeGreaterThan(0)
    expect(screen.queryByText("PM")).not.toBeInTheDocument()
    expect(screen.getAllByText("Pickachu").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "ซื้อล่าสุด ↓" })).toHaveAttribute(
      "href",
      "/crm/customers?sort=last_purchase&order=asc"
    )
  })

  it("queries fallback salesperson from latest invoice when customer salesperson is empty", async () => {
    await CustomersPage({ searchParams: Promise.resolve({}) })

    const listQuery = String((prisma.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] ?? "")
    expect(listQuery).toContain("doc_sp.name")
    expect(listQuery).toContain("COALESCE(s.name, doc_sp.name) AS salesperson_name")
  })

  it("renders purchase status filters and filters customers by displayed status", async () => {
    const jsx = await CustomersPage({ searchParams: Promise.resolve({ purchase: "not_purchased" }) })
    render(jsx)

    expect(screen.getByRole("link", { name: "ทั้งหมด" })).toHaveAttribute("href", "/crm/customers?sort=last_purchase&order=desc")
    expect(screen.getByRole("link", { name: "ซื้อแล้ว" })).toHaveAttribute(
      "href",
      "/crm/customers?sort=last_purchase&order=desc&purchase=purchased"
    )
    expect(screen.getByRole("link", { name: "ยังไม่ได้ซื้อ ✕" })).toHaveAttribute(
      "href",
      "/crm/customers?sort=last_purchase&order=desc"
    )

    expect(queryCallText(0)).toContain("c.status = 'not_purchase_yet'")
    expect(queryCallText(1)).toContain("c.status = 'not_purchase_yet'")
  })

  it("filters purchased customers by excluding not-purchase-yet status", async () => {
    await CustomersPage({ searchParams: Promise.resolve({ purchase: "purchased" }) })

    expect(queryCallText(0)).toContain("c.status <> 'not_purchase_yet'")
    expect(queryCallText(1)).toContain("c.status <> 'not_purchase_yet'")
  })
})

function queryCallText(index: number) {
  return (prisma.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[index]
    .map((part) => {
      if (typeof part === "string") return part
      if (Array.isArray(part)) return part.join("")
      if (part && typeof part === "object" && "strings" in part) {
        return String((part as { strings?: unknown }).strings)
      }
      return String(part)
    })
    .join(" ")
}
