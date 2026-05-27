import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/auth-bypass", () => ({
  isAuthBypassed: vi.fn(() => false),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/customers/merge/preview/route"

const mockSession = { user: { email: "admin@sakww.com" } } as Awaited<ReturnType<typeof auth>>

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/merge/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/customers/merge/preview", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))

    expect(res.status).toBe(401)
  })

  it("returns preview data with document and deal counts", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      {
        id: 1,
        name: "ยู พัซเซิล",
        taxId: null,
        _count: { documents: 10, deals: 2 },
      },
      {
        id: 2,
        name: "ยู พัซเซิล (สำนักงานใหญ่)",
        taxId: "0100000000000",
        _count: { documents: 4, deals: 1 },
      },
    ] as Awaited<ReturnType<typeof prisma.customer.findMany>>)

    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      primary: {
        id: 1,
        name: "ยู พัซเซิล",
        taxId: null,
        documentCount: 10,
        dealCount: 2,
      },
      duplicates: [
        {
          id: 2,
          name: "ยู พัซเซิล (สำนักงานใหญ่)",
          taxId: "0100000000000",
          documentCount: 4,
          dealCount: 1,
        },
      ],
      totals: {
        documentCount: 4,
        dealCount: 1,
      },
    })
  })

  it("returns 404 when any requested customer is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      { id: 1, name: "Main", taxId: null, _count: { documents: 0, deals: 0 } },
    ] as Awaited<ReturnType<typeof prisma.customer.findMany>>)

    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))

    expect(res.status).toBe(404)
  })
})
