export const UNKNOWN_SALESPERSON_LABEL = "ไม่มีชื่อพนักงาน"

export function formatSalespersonName(name?: string | null) {
  return name?.trim() || UNKNOWN_SALESPERSON_LABEL
}
