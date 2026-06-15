import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    salesperson: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound")
  }),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl/server", async () => {
  const messages = (await import("../../messages/th.json")).default

  return {
    getTranslations: vi.fn(async () => (key: string) => {
      if (key === "title") return messages.CustomerEdit.title
      return key
    }),
  }
})

vi.mock("@/app/[locale]/crm/customers/CustomerEditForm", () => ({
  default: ({
    customer,
    salespersons,
  }: {
    customer: { salespersonId: number | null }
    salespersons: { id: number; name: string }[]
  }) => (
    <div>
      <p>selected salesperson: {customer.salespersonId ?? "none"}</p>
      <p>salesperson options: {salespersons.map((sp) => sp.name).join(", ")}</p>
    </div>
  ),
}))

import { prisma } from "@/lib/prisma"
import CustomerEditPage from "@/app/[locale]/crm/customers/[id]/edit/page"

describe("CustomerEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.salesperson.findMany).mockResolvedValue([
      { id: 2, name: "Pickachu" },
      { id: 3, name: "Wanida" },
    ] as Awaited<ReturnType<typeof prisma.salesperson.findMany>>)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it("uses latest document salesperson as edit default when customer salesperson is missing", async () => {
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({
      id: 1080,
      name: "ยู พัซเซิล",
      taxId: null,
      vatRegistered: true,
      type: null,
      status: "active",
      province: null,
      address: null,
      phone: null,
      email: null,
      lineId: null,
      otherId: null,
      salespersonId: null,
      documents: [{ salespersonId: 2, salesperson: { name: "Pickachu" } }],
    } as Awaited<ReturnType<typeof prisma.customer.findUnique>>)

    const jsx = await CustomerEditPage({ params: Promise.resolve({ id: "1080" }) })
    render(jsx)

    expect(screen.getByText("selected salesperson: 2")).toBeInTheDocument()
  })
})
