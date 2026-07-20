import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/lib/line", () => ({
  pushMessage: vi.fn(),
}))

vi.mock("@/lib/ai", () => ({
  draftFollowUpMessage: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { pushMessage } from "@/lib/line"
import { draftFollowUpMessage } from "@/lib/ai"
import { GET } from "@/app/api/notify/route"

function makeRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/notify?token=${token}`)
}

describe("GET /api/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NOTIFY_SECRET", "my-secret")
    ;(draftFollowUpMessage as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 for wrong token", async () => {
    const res = await GET(makeRequest("wrong"))
    expect(res.status).toBe(401)
  })

  it("returns 401 when NOTIFY_SECRET is not set", async () => {
    vi.unstubAllEnvs()
    const res = await GET(makeRequest("my-secret"))
    expect(res.status).toBe(401)
  })

  it("sends push message for each lapsed customer", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "บริษัท เคไอที จำกัด",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 137,
        order_count: BigInt(12),
        last_total: 27960,
      },
      {
        id: 2,
        customer_name: "ร้านหนึ่ง",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2025-12-01"),
        days_since: 168,
        order_count: BigInt(3),
        last_total: 5990,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(2)
    expect(data.errors).toHaveLength(0)
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว\n📦 ซื้อทั้งหมด 12 ครั้ง\n💰 ยอดล่าสุด ฿27,960"
    )
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "⚠️ ร้านหนึ่ง ไม่ได้ซื้อมา 168 วันแล้ว\n📦 ซื้อทั้งหมด 3 ครั้ง\n💰 ยอดล่าสุด ฿5,990"
    )
  })

  it("continues and records error when LINE push fails for one customer", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "ลูกค้า A",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 100,
        order_count: BigInt(5),
        last_total: 1000,
      },
      {
        id: 2,
        customer_name: "ลูกค้า B",
        line_user_id: "Uabc222",
        salesperson_name: "Ash",
        last_purchase: new Date("2025-12-01"),
        days_since: 150,
        order_count: BigInt(5),
        last_total: 1000,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("LINE push failed: 429 rate limited"))
      .mockResolvedValueOnce(undefined)

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toContain("customer_id=1")
  })

  it("returns 500 when DB query fails", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused")
    )
    const res = await GET(makeRequest("my-secret"))
    expect(res.status).toBe(500)
  })

  it("uses the AI-drafted message when draftFollowUpMessage returns text", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "บริษัท เคไอที จำกัด",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 137,
        order_count: BigInt(12),
        last_total: 27960,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(draftFollowUpMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
      "สวัสดีค่ะคุณลูกค้า ไม่ได้ติดต่อกันนานเลยนะคะ"
    )

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "สวัสดีค่ะคุณลูกค้า ไม่ได้ติดต่อกันนานเลยนะคะ"
    )
  })

  it("falls back to the template message when draftFollowUpMessage returns null", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "บริษัท เคไอที จำกัด",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 137,
        order_count: BigInt(12),
        last_total: 27960,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(draftFollowUpMessage as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว\n📦 ซื้อทั้งหมด 12 ครั้ง\n💰 ยอดล่าสุด ฿27,960"
    )
  })

  it("falls back to the template message when draftFollowUpMessage throws", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "บริษัท เคไอที จำกัด",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 137,
        order_count: BigInt(12),
        last_total: 27960,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(draftFollowUpMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error")
    )

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(data.errors).toHaveLength(0)
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว\n📦 ซื้อทั้งหมด 12 ครั้ง\n💰 ยอดล่าสุด ฿27,960"
    )
  })
})
