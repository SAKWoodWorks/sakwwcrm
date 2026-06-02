import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/salespersons/route"

const mockSession = { user: { email: "test@sakww.com" } } as Awaited<ReturnType<typeof auth>>

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/salespersons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/salespersons", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(makeReq({ name: "Pickachu" }))
    expect(res.status).toBe(401)
  })

  it("requires name", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await POST(makeReq({ name: " " }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when salesperson already exists", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findFirst).mockResolvedValue({ id: 1 } as never)
    const res = await POST(makeReq({ name: "Pickachu" }))
    expect(res.status).toBe(409)
  })

  it("creates salesperson with trimmed fields", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.salesperson.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.salesperson.create).mockResolvedValue({ id: 7 } as never)
    const res = await POST(makeReq({ name: " Pickachu ", channel: " Web ", active: true }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 7 })
    expect(prisma.salesperson.create).toHaveBeenCalledWith({
      data: { name: "Pickachu", channel: "Web", active: true },
      select: { id: true },
    })
  })
})
