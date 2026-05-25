import { describe, expect, it } from "vitest"
import { formatSalespersonName } from "@/lib/salesperson-display"

describe("formatSalespersonName", () => {
  it("returns salesperson name when present", () => {
    expect(formatSalespersonName("Wanida")).toBe("Wanida")
  })

  it("returns Thai unknown label when missing", () => {
    expect(formatSalespersonName(null)).toBe("ไม่มีชื่อพนักงาน")
    expect(formatSalespersonName("")).toBe("ไม่มีชื่อพนักงาน")
  })
})
