export type DeliveryVehicle = "4w" | "6w"

export type DeliveryTier = {
  label: string
  maxAmount: number | null
  cost: number
}

export type DeliveryCostRow = {
  no: number
  provinceThai: string
  provinceEnglish: string
  tiers: Record<DeliveryVehicle, DeliveryTier[]>
}

export function selectDeliveryTier(tiers: DeliveryTier[], invoiceAmount: number | null) {
  if (tiers.length === 0) return null
  if (invoiceAmount == null || !Number.isFinite(invoiceAmount)) return tiers[0]

  return tiers.find((tier) => tier.maxAmount != null && invoiceAmount < tier.maxAmount) ?? tiers[tiers.length - 1]
}
