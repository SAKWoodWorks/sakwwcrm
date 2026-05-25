export const DEAL_STAGES = [
  "lead",
  "qualified",
  "quotation",
  "negotiation",
  "won",
  "lost",
] as const

export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  quotation: "Quotation",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
}

export const DEAL_STAGE_CLASSES: Record<DealStage, string> = {
  lead: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-800",
  quotation: "bg-purple-100 text-purple-800",
  negotiation: "bg-yellow-100 text-yellow-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
}

export function isDealStage(value: unknown): value is DealStage {
  return typeof value === "string" && DEAL_STAGES.includes(value as DealStage)
}

export function formatDealStage(stage: string): string {
  return isDealStage(stage) ? DEAL_STAGE_LABELS[stage] : stage
}

export function dealStageClass(stage: string): string {
  return isDealStage(stage) ? DEAL_STAGE_CLASSES[stage] : "bg-gray-100 text-gray-700"
}
