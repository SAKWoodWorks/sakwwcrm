import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/delivery-costs", () => ({
  getDeliveryCosts: vi.fn(async () => []),
}))

vi.mock("next-intl/server", async () => {
  const messages = (await import("../../messages/ru.json")).default

  function lookup(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages.DeliveryCost)
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

vi.mock("next-intl", async () => {
  const messages = (await import("../../messages/ru.json")).default

  function lookup(key: string) {
    return key.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object" && part in value) {
        return (value as Record<string, unknown>)[part]
      }
      return undefined
    }, messages.DeliveryCost)
  }

  return {
    useLocale: () => "ru",
    useTranslations: () => (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    },
  }
})

import DeliveryCostPage from "@/app/[locale]/crm/delivery-cost/page"

describe("DeliveryCostPage i18n", () => {
  it("renders delivery cost page labels in Russian", async () => {
    const jsx = await DeliveryCostPage()
    render(jsx)

    expect(screen.getAllByText("Стоимость доставки").length).toBeGreaterThan(0)
    expect(screen.getByText("Поиск провинции")).toBeInTheDocument()
    expect(screen.getAllByText("Провинции в файле")[0]).toBeInTheDocument()
    expect(screen.queryByText("ค้นหาจังหวัด")).not.toBeInTheDocument()
  })
})
