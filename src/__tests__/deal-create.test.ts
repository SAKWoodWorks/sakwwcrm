import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deal: { create: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { POST } from "@/app/api/deals/route"

const validBody = {
  title: "ไม้อัดล็อตใหม่ - บริษัท ABC",
  customerId: 1,
  salespersonId: 2,
  stage: "qualified",
  expectedValue: 150000,
  probability: 40,
  expectedCloseDate: "2026-06-15",
  source: "LINE",
  notes: "ลูกค้าขอราคาเพิ่ม",
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/deals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/deals", () => {
  const originalDisableAuth = process.env.DISABLE_AUTH

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DISABLE_AUTH
  })

  afterEach(() => {
    if (originalDisableAuth === undefined) {
      delete process.env.DISABLE_AUTH
    } else {
      process.env.DISABLE_AUTH = originalDisableAuth
    }
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("allows creating deal without session when auth bypass is enabled", async () => {
    process.env.DISABLE_AUTH = "true"
    vi.mocked(auth).mockResolvedValue(null as never)
    vi.mocked(prisma.deal.create).mockResolvedValue({ id: 44 } as never)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 44 })
  })

  it("returns 400 when title is blank", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await POST(makeRequest({ ...validBody, title: "   " }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid stage", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await POST(makeRequest({ ...validBody, stage: "stuck" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when probability is outside 0-100", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await POST(makeRequest({ ...validBody, probability: 120 }))
    expect(res.status).toBe(400)
  })

  it("creates deal and returns its id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    vi.mocked(prisma.deal.create).mockResolvedValue({ id: 33 } as never)

    const res = await POST(makeRequest({ ...validBody, title: "  ดีลใหม่  " }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 33 })
    expect(prisma.deal.create).toHaveBeenCalledWith({
      data: {
        title: "ดีลใหม่",
        customerId: 1,
        salespersonId: 2,
        stage: "qualified",
        expectedValue: 150000,
        probability: 40,
        expectedCloseDate: new Date("2026-06-15"),
        source: "LINE",
        notes: "ลูกค้าขอราคาเพิ่ม",
      },
      select: { id: true },
    })
  })

  it("returns 400 on P2003 foreign key violation for invalid customerId/salespersonId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const err = Object.assign(
      new Error("Foreign key constraint failed"),
      { code: "P2003", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.deal.create).mockRejectedValue(err)

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid customerId or salespersonId" })
  })

  it("returns 500 on unexpected error during create", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    vi.mocked(prisma.deal.create).mockRejectedValue(new Error("db down"))

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(500)
  })
})
