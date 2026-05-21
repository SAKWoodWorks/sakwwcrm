import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { PATCH } from "@/app/api/documents/[id]/payment/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/documents/1/payment", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/documents/[id]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id like '5abc'", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid status", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    const res = await PATCH(makeRequest({ status: "invalid" }), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("updates to paid and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    const res = await PATCH(makeRequest({ status: "paid" }), makeParams("5"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "paid" })
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { paymentStatus: "paid" },
    })
  })

  it("updates to pending and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "test@sakww.com" } } as any)
    vi.mocked(prisma.document.update).mockResolvedValue({} as any)
    const res = await PATCH(makeRequest({ status: "pending" }), makeParams("3"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "pending" })
  })
})
