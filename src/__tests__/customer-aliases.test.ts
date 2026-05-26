import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/auth-bypass", () => ({
  isAuthBypassed: vi.fn(() => false),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/customers/[id]/aliases/route"
import { DELETE } from "@/app/api/customers/[id]/aliases/[aliasId]/route"

const mockSession = { user: {} } as Awaited<ReturnType<typeof auth>>

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/1/aliases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makePostParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeDeleteParams(id: string, aliasId: string) {
  return { params: Promise.resolve({ id, aliasId }) }
}

describe("POST /api/customers/[id]/aliases", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(makePostReq({ aliasName: "Old Name" }), makePostParams("1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid customer id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await POST(makePostReq({ aliasName: "Old Name" }), makePostParams("1abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when aliasName is blank", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await POST(makePostReq({ aliasName: "   " }), makePostParams("1"))
    expect(res.status).toBe(400)
  })

  it("creates customer alias", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.customer.findUnique).mockResolvedValue({ id: 1 } as Awaited<ReturnType<typeof prisma.customer.findUnique>>)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      {
        id: 9,
        alias_name: "Old Name",
        alias_type: "former_name",
        tax_id: null,
        note: "former",
      },
    ])

    const res = await POST(makePostReq({ aliasName: " Old Name ", note: " former " }), makePostParams("1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      alias: {
        id: 9,
        aliasName: "Old Name",
        aliasType: "former_name",
        taxId: null,
        note: "former",
      },
    })
  })
})

describe("DELETE /api/customers/[id]/aliases/[aliasId]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 400 for invalid ids", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await DELETE(new Request("http://localhost"), makeDeleteParams("1", "2abc"))
    expect(res.status).toBe(400)
  })

  it("deletes customer alias", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    const res = await DELETE(new Request("http://localhost"), makeDeleteParams("1", "2"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("returns 404 when alias is not found", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0)
    const res = await DELETE(new Request("http://localhost"), makeDeleteParams("1", "2"))
    expect(res.status).toBe(404)
  })
})
