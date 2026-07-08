export const UNKNOWN_SALESPERSON_LABEL = "ไม่มีชื่อพนักงาน"

export function formatSalespersonName(name?: string | null, fallbackLabel: string = UNKNOWN_SALESPERSON_LABEL) {
  const trimmed = name?.trim()
  if (!trimmed) return fallbackLabel

  return trimmed.split("+", 1)[0].trim() || fallbackLabel
}
