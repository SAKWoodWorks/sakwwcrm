import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next-intl/server", async () => {
  const messages = (await import("../../messages/ru.json")).default

  function lookup(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages.Dashboard)
  }

  return {
    getLocale: vi.fn(async () => "ru"),
    getTranslations: vi.fn(async () => (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    }),
  }
})

import { prisma } from "@/lib/prisma"
import DashboardPage from "@/app/[locale]/crm/dashboard/page"

describe("DashboardPage i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          total_customers: BigInt(12),
          monthly_revenue: 25000,
          monthly_invoices: BigInt(4),
          lapsed_count: BigInt(2),
          pending_invoices: BigInt(1),
          new_customers: BigInt(3),
          monthly_quotations: BigInt(5),
          monthly_quotation_revenue: 15000,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 7,
          name: "Customer A",
          lifetime_total: 90000,
          last_purchase_date: new Date("2026-06-01"),
        },
      ])
      .mockResolvedValueOnce([
        {
          product_id: 9,
          sku_code: "SKU-9",
          product_name: "Product A",
          description: null,
          sold_amount: 12000,
          sold_qty: 8,
        },
      ])
  })

  it("renders dashboard body labels in Russian when RU locale is active", async () => {
    const jsx = await DashboardPage()
    render(jsx)

    expect(screen.getByText("Всего клиентов")).toBeInTheDocument()
    expect(screen.getByText("Лучшие товары месяца")).toBeInTheDocument()
    expect(screen.getByText("Quotation vs Invoice за этот месяц")).toBeInTheDocument()
    expect(screen.getByText("Топ 10 клиентов (оплаченные покупки)")).toBeInTheDocument()
    expect(screen.queryByText("ลูกค้าทั้งหมด")).not.toBeInTheDocument()
  })
})
