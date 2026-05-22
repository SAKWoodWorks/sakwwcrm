import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/line", () => ({
  verifySignature: vi.fn(),
  replyMessage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    document: {
      aggregate: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { verifySignature, replyMessage } from "@/lib/line"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/line/webhook/route"

function makeRequest(body: object, signature = "valid-sig"): NextRequest {
  return new NextRequest("http://localhost/api/line/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-line-signature": signature,
    },
  })
}

function makeTextEvent(text: string, userId = "Uabc123", replyToken = "reply-token-code") {
  return {
    type: "message",
    replyToken,
    source: { userId },
    message: { type: "text", text },
  }
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(verifySignature as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(replyMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it("returns 401 when signature is invalid", async () => {
    ;(verifySignature as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const req = makeRequest({ events: [] }, "bad-sig")
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("replies with registration prompt on follow event", async () => {
    const req = makeRequest({
      events: [{ type: "follow", replyToken: "reply-token-1" }],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(replyMessage).toHaveBeenCalledWith(
      "reply-token-1",
      "กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน (เช่น Pickachu)"
    )
  })

  it("saves line_user_id and replies success when name matches", async () => {
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)           // lineUserId check → not registered
      .mockResolvedValueOnce(null)           // linkCode check → no match
      .mockResolvedValueOnce({ id: 5, name: "Pickachu" })  // name check → found
    ;(prisma.salesperson.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-2",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "Pickachu" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(prisma.salesperson.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { lineUserId: "Uabc123" },
    })
    expect(replyMessage).toHaveBeenCalledWith("reply-token-2", "ลงทะเบียนสำเร็จ ✅")
  })

  it("replies not-found when name does not match", async () => {
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)   // lineUserId check
      .mockResolvedValueOnce(null)   // linkCode check
      .mockResolvedValueOnce(null)   // name check

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-3",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "Unknown Name" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(replyMessage).toHaveBeenCalledWith(
      "reply-token-3",
      "ไม่พบชื่อในระบบ กรุณาลองใหม่"
    )
    expect(prisma.salesperson.update).not.toHaveBeenCalled()
  })

  it("links via code when valid code is sent", async () => {
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)                        // lineUserId → not registered
      .mockResolvedValueOnce({ id: 7, name: "Test SP" }) // linkCode → match
    ;(prisma.salesperson.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(replyMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const req = makeRequest({ events: [makeTextEvent("ABC123")] })
    await POST(req)

    expect(prisma.salesperson.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { lineUserId: expect.any(String), linkCode: null, linkCodeExpiresAt: null },
    })
    expect(replyMessage).toHaveBeenCalledWith(expect.any(String), "ลงทะเบียนสำเร็จ ✅")
  })

  describe("customer search (registered salesperson)", () => {
    beforeEach(() => {
      // salesperson IS registered (lineUserId matches)
      ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 5,
        name: "Pickachu",
        lineUserId: "Uabc123",
      })
    })

    it("replies not-found when no customers match", async () => {
      ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const req = makeRequest({
        events: [
          {
            type: "message",
            replyToken: "reply-token-search",
            source: { userId: "Uabc123" },
            message: { type: "text", text: "ลูกค้าหายาก" },
          },
        ],
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(replyMessage).toHaveBeenCalledWith(
        "reply-token-search",
        "ไม่พบลูกค้า: ลูกค้าหายาก"
      )
    })

    it("replies with name list when more than 3 customers match", async () => {
      ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          name: `บริษัท ABC ${i + 1} จำกัด`,
          province: "Bangkok",
          type: "retail",
          documents: [],
        }))
      )

      const req = makeRequest({
        events: [
          {
            type: "message",
            replyToken: "reply-token-list",
            source: { userId: "Uabc123" },
            message: { type: "text", text: "ABC" },
          },
        ],
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const call = (replyMessage as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[1]).toContain("พบ 5 รายการ")
      expect(call[1]).toContain("บริษัท ABC 1 จำกัด")
    })

    it("replies with customer profile when 1 customer matches", async () => {
      ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 10,
          name: "บริษัท เคไอที จำกัด",
          province: "PTPU",
          type: "dealer",
          documents: [
            {
              docNumber: "258V",
              docDate: new Date("2025-03-15"),
              docType: "tax_invoice",
              total: 27960,
              paymentStatus: "paid",
            },
          ],
        },
      ])
      ;(prisma.document.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _sum: { total: 320000 },
      })
      ;(prisma.document.count as ReturnType<typeof vi.fn>).mockResolvedValue(12)

      const req = makeRequest({
        events: [
          {
            type: "message",
            replyToken: "reply-token-profile",
            source: { userId: "Uabc123" },
            message: { type: "text", text: "เคไอที" },
          },
        ],
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const call = (replyMessage as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(call[1]).toContain("บริษัท เคไอที จำกัด")
      expect(call[1]).toContain("PTPU")
      expect(call[1]).toContain("12 ครั้ง")
      expect(call[1]).toContain("258V")
      expect(call[1]).toContain("✅")
    })
  })
})
