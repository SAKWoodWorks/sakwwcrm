import { render, screen } from "@testing-library/react"
import { describe, expect, it, beforeEach, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    salesperson: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/app/[locale]/crm/documents/DocumentFilters", () => ({
  default: () => <div>Document filters</div>,
}))

vi.mock("@/app/[locale]/crm/documents/PaymentToggle", () => ({
  default: () => <div>Payment toggle</div>,
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

  function lookup(namespace: keyof typeof messages, key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages[namespace])
  }

  return {
    getLocale: vi.fn(async () => "th"),
    getTranslations: vi.fn(async (namespace: keyof typeof messages) => (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(namespace, key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    }),
  }
})

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound")
  }),
}))

import DocumentsPage from "@/app/[locale]/crm/documents/page"
import DocumentDetailPage from "@/app/[locale]/crm/documents/[id]/page"
import { prisma } from "@/lib/prisma"

describe("document returnTo navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.salesperson.findMany).mockResolvedValue([])
    vi.mocked(prisma.document.count).mockResolvedValue(1)
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 5,
        docType: "tax_invoice",
        docNumber: "TI-005",
        docDate: new Date("2026-05-15T00:00:00.000Z"),
        channel: "LINE",
        paymentStatus: "paid",
        total: 15000,
        customer: { id: 10, name: "บริษัท ทดสอบ จำกัด" },
        salesperson: { name: "Pickachu" },
      },
    ] as Awaited<ReturnType<typeof prisma.document.findMany>>)
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 5,
      docType: "tax_invoice",
      docNumber: "TI-005",
      docDate: new Date("2026-05-15T00:00:00.000Z"),
      channel: "LINE",
      paymentStatus: "paid",
      subtotal: 14000,
      vat: 1000,
      total: 15000,
      refDocNumber: null,
      notes: null,
      gdriveFilename: "TI-005.xlsx",
      customer: { id: 10, name: "บริษัท ทดสอบ จำกัด" },
      salesperson: { name: "Pickachu" },
      items: [],
    } as Awaited<ReturnType<typeof prisma.document.findUnique>>)
  })

  it("keeps current document filters when opening detail", async () => {
    const jsx = await DocumentsPage({
      searchParams: Promise.resolve({
        type: "quotation",
        status: "pending",
        page: "2",
        sort: "total",
        order: "asc",
      }),
    })
    render(jsx)

    const href = screen.getAllByRole("link", { name: "TI-005" })[0].getAttribute("href")
    expect(href).toBe(
      `/crm/documents/5?${new URLSearchParams({
        returnTo: "/crm/documents?type=quotation&status=pending&sort=total&order=asc&page=2",
      }).toString()}`,
    )
  })

  it("uses safe returnTo param for document list link", async () => {
    const returnTo = "/crm/documents?type=quotation&status=pending&page=2"
    const jsx = await DocumentDetailPage({
      params: Promise.resolve({ id: "5" }),
      searchParams: Promise.resolve({ returnTo }),
    })
    render(jsx)

    expect(screen.getByRole("link", { name: "← เอกสาร" })).toHaveAttribute("href", returnTo)
  })
})
