import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: { update: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { DELETE } from "@/app/api/salespersons/[id]/line/route"
import { POST } from "@/app/api/salespersons/[id]/line/code/route"

const mockSession = { user: {} } as Awaited<ReturnType<typeof auth>>
const mockSalesperson = {} as Awaited<ReturnType<typeof prisma.salesperson.update>>
const unlinkedSalesperson = { lineUserId: null } as Awaited<ReturnType<typeof prisma.salesperson.findUnique>>
const linkedSalesperson = { lineUserId: "U123" } as Awaited<ReturnType<typeof prisma.salesperson.findUnique>>

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeP2025() {
  const err = Object.assign(new Error("Not found"), { code: "P2025", clientVersion: "0.0.0" })
  Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
  return err
}

describe("DELETE /api/salespersons/[id]/line", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/salespersons/5/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/api/salespersons/abc/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/api/salespersons/5abc/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("clears lineUserId, linkCode, linkCodeExpiresAt and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.update).mockResolvedValue(mockSalesperson)
    const req = new NextRequest("http://localhost/api/salespersons/5/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(prisma.salesperson.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { lineUserId: null, linkCode: null, linkCodeExpiresAt: null },
    })
  })

  it("returns 404 on P2025", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.update).mockRejectedValue(makeP2025())
    const req = new NextRequest("http://localhost/api/salespersons/99/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("99"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/salespersons/[id]/line/code", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    const res = await POST(req, makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/api/salespersons/abc/line/code", { method: "POST" })
    const res = await POST(req, makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 200 with 6-char code and expiresAt", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findUnique).mockResolvedValue(unlinkedSalesperson)
    vi.mocked(prisma.salesperson.update).mockResolvedValue(mockSalesperson)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    const before = Date.now()
    const res = await POST(req, makeParams("5"))
    const after = Date.now()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.code).toBe("string")
    expect(json.code).toHaveLength(6)
    expect(json.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    const expiresMs = new Date(json.expiresAt).getTime()
    expect(expiresMs).toBeGreaterThan(before + 14 * 60 * 1000)
    expect(expiresMs).toBeLessThan(after + 16 * 60 * 1000)
  })

  it("returns 409 when salesperson is already linked", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findUnique).mockResolvedValue(linkedSalesperson)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    const res = await POST(req, makeParams("5"))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe("Already linked")
  })

  it("saves code and expiresAt to DB", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findUnique).mockResolvedValue(unlinkedSalesperson)
    vi.mocked(prisma.salesperson.update).mockResolvedValue(mockSalesperson)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    await POST(req, makeParams("5"))
    expect(prisma.salesperson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          linkCode: expect.stringMatching(/^[A-HJ-NP-Z2-9]{6}$/),
          linkCodeExpiresAt: expect.any(Date),
        }),
      })
    )
  })

  it("returns 404 when salesperson does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findUnique).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/salespersons/99/line/code", { method: "POST" })
    const res = await POST(req, makeParams("99"))
    expect(res.status).toBe(404)
  })

  it("returns 404 on P2025 during update", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findUnique).mockResolvedValue(unlinkedSalesperson)
    vi.mocked(prisma.salesperson.update).mockRejectedValue(makeP2025())
    const req = new NextRequest("http://localhost/api/salespersons/99/line/code", { method: "POST" })
    const res = await POST(req, makeParams("99"))
    expect(res.status).toBe(404)
  })
})
