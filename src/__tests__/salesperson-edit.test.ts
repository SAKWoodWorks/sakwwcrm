import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PATCH } from "@/app/api/salespersons/[id]/route"

const mockSession = { user: { email: "test@sakww.com" } } as Awaited<ReturnType<typeof auth>>
const mockSalesperson = {} as Awaited<ReturnType<typeof prisma.salesperson.update>>

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/salespersons/5", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/salespersons/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeReq({ name: "Pickachu" }), makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq({ name: "Pickachu" }), makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("requires name", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq({ name: " " }), makeParams("5"))
    expect(res.status).toBe(400)
  })

  it("updates trimmed name, channel, and active flag", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.update).mockResolvedValue(mockSalesperson)
    const res = await PATCH(makeReq({ name: " Pickachu ", channel: " LINE ", active: true }), makeParams("5"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(prisma.salesperson.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: "Pickachu", channel: "LINE", active: true },
    })
  })

  it("returns 404 on P2025", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const err = Object.assign(new Error("Not found"), { code: "P2025", clientVersion: "0.0.0" })
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.salesperson.update).mockRejectedValue(err)
    const res = await PATCH(makeReq({ name: "Pickachu" }), makeParams("99"))
    expect(res.status).toBe(404)
  })
})
