import path from "node:path"
import { describe, expect, it } from "vitest"
import { getDeliveryCosts } from "@/lib/delivery-costs"
import { selectDeliveryTier } from "@/lib/delivery-cost-types"

describe("delivery costs", () => {
  const rows = getDeliveryCosts(path.join(process.cwd(), "docs", "Delivery.xlsx"))

  it("reads Delivery sheet into province rows with 4W and 6W tiers", () => {
    const bangkok = rows.find((row) => row.provinceEnglish === "Bangkok")

    expect(rows.length).toBeGreaterThan(70)
    expect(bangkok?.provinceThai).toBe("กรุงเทพมหานคร")
    expect(bangkok?.tiers["4w"][0]).toMatchObject({ label: "ปกติ", cost: 1500 })
    expect(bangkok?.tiers["6w"][0]).toMatchObject({ label: "ปกติ", cost: 3500 })
  })

  it("selects the invoice amount tier and treats zero cost as valid", () => {
    const bangkok = rows.find((row) => row.provinceEnglish === "Bangkok")
    expect(bangkok).toBeDefined()

    const tier = selectDeliveryTier(bangkok!.tiers["4w"], 30000)
    const freeTier = selectDeliveryTier(bangkok!.tiers["4w"], 60000)

    expect(tier).toMatchObject({ label: "<50000", cost: 0 })
    expect(freeTier).toMatchObject({ label: "<75000", cost: 0 })
  })
})
