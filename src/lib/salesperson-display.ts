export const UNKNOWN_SALESPERSON_LABEL = "ไม่มีชื่อพนักงาน"

export function formatSalespersonName(name?: string | null) {
  const trimmed = name?.trim()
  if (!trimmed) return UNKNOWN_SALESPERSON_LABEL

  return trimmed.split("+", 1)[0].trim() || UNKNOWN_SALESPERSON_LABEL
}
