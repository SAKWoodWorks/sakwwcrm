import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    salesperson: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next-intl/server", async () => {
  const messages = (await import("../../messages/en.json")).default

  function lookup(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages.FollowUp)
  }

  return {
    getLocale: vi.fn(async () => "en"),
    getTranslations: vi.fn(async () => (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    }),
  }
})

vi.mock("next-intl", async () => {
  const messages = (await import("../../messages/en.json")).default

  function lookup(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages.FollowUp)
  }

  return {
    useTranslations: () => (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    },
  }
})

import { prisma } from "@/lib/prisma"
import FollowUpPage from "@/app/[locale]/crm/follow-up/page"

describe("FollowUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        customer_id: 10,
        customer_name: "Acme Timber",
        phone: "0890000000",
        line_id: "acme-line",
        salesperson_id: 2,
        salesperson_name: "Pickachu",
        last_paid_date: new Date("2026-04-15T00:00:00.000Z"),
        days_since_purchase: 62,
        last_invoice_total: 12000,
        total_paid: 98000,
        recent_products: "Teak Board, Pine Board",
      },
      {
        customer_id: 11,
        customer_name: "Quiet Customer",
        phone: null,
        line_id: null,
        salesperson_id: null,
        salesperson_name: null,
        last_paid_date: new Date("2025-12-01T00:00:00.000Z"),
        days_since_purchase: 190,
        last_invoice_total: 5000,
        total_paid: 20000,
        recent_products: null,
      },
    ])
    vi.mocked(prisma.salesperson.findMany).mockResolvedValue([
      { id: 2, name: "Pickachu" },
    ] as Awaited<ReturnType<typeof prisma.salesperson.findMany>>)
  })

  it("renders follow-up customers with bucket summaries and links", async () => {
    const jsx = await FollowUpPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getByText("Customer follow-up")).toBeInTheDocument()
    expect(screen.getAllByText("60-89 days").length).toBeGreaterThan(0)
    expect(screen.getAllByText("180+ days").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: "Acme Timber" })[0]).toHaveAttribute("href", "/crm/customers/10")
    expect(screen.getAllByText("0890000000 / LINE: acme-line").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Pickachu").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Teak Board, Pine Board").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Unknown product").length).toBeGreaterThan(0)
  })

  it("filters rows by selected salesperson and bucket", async () => {
    const jsx = await FollowUpPage({
      searchParams: Promise.resolve({ salesperson: "2", bucket: "60_89" }),
    })
    render(jsx)

    expect(screen.getAllByText("Acme Timber").length).toBeGreaterThan(0)
    expect(screen.queryByText("Quiet Customer")).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Follow-up age" })).toHaveTextContent("60-89 days")
    expect(screen.getByRole("combobox", { name: "Salesperson" })).toHaveTextContent("Pickachu")
  })

  it("does not cap query rows before bucket filtering", () => {
    const source = readFileSync("src/app/[locale]/crm/follow-up/page.tsx", "utf8")

    expect(source).not.toMatch(/\bLIMIT\s+500\b/i)
  })
})
