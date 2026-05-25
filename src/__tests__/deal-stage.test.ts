import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deal: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { PATCH } from "@/app/api/deals/[id]/stage/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/deals/1/stage", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/deals/[id]/stage", () => {
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
    const res = await PATCH(makeRequest({ stage: "qualified" }), makeParams("1"))
    expect(res.status).toBe(401)
  })

  it("allows updating stage without session when auth bypass is enabled", async () => {
    process.env.DISABLE_AUTH = "true"
    vi.mocked(auth).mockResolvedValue(null as never)
    vi.mocked(prisma.deal.update).mockResolvedValue({} as never)

    const res = await PATCH(makeRequest({ stage: "won" }), makeParams("8"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, stage: "won" })
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await PATCH(makeRequest({ stage: "qualified" }), makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id like '5abc'", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await PATCH(makeRequest({ stage: "qualified" }), makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid stage", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const res = await PATCH(makeRequest({ stage: "stuck" }), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("updates stage and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    vi.mocked(prisma.deal.update).mockResolvedValue({} as never)

    const res = await PATCH(makeRequest({ stage: "negotiation" }), makeParams("12"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, stage: "negotiation" })
    expect(prisma.deal.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { stage: "negotiation" },
    })
  })

  it("returns 404 when deal does not exist (P2025)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as never)
    const err = Object.assign(
      new Error("Record not found"),
      { code: "P2025", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.deal.update).mockRejectedValue(err)

    const res = await PATCH(makeRequest({ stage: "won" }), makeParams("99"))

    expect(res.status).toBe(404)
  })
})
