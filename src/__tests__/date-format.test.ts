import { formatDate, formatDateTime } from "@/lib/utils"
import { describe, expect, it } from "vitest"

describe("date formatters", () => {
  it("formats a calendar date as dd/MM/yyyy in the Gregorian calendar", () => {
    expect(formatDate(new Date("2026-08-07T00:00:00.000Z"))).toBe("07/08/2026")
  })

  it("formats a timestamp with its date first", () => {
    expect(formatDateTime(new Date("2026-08-07T02:30:00.000Z"))).toBe("07/08/2026 09:30")
  })
})
