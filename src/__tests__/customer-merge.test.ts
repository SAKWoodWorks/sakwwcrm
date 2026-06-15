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
    $transaction: vi.fn(),
  },
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/customers/merge/route"

const mockSession = { user: { email: "admin@sakww.com" } } as Awaited<ReturnType<typeof auth>>

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/customers/merge", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when primary id is included in duplicate ids", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [1, 2] }))
    expect(res.status).toBe(400)
  })

  it("merges duplicate customers into primary customer", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        customer: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, name: "ยู พัซเซิล", taxId: null },
            { id: 2, name: "ยู พัซเซิล (สำนักงานใหญ่)", taxId: "0100000000000" },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        document: {
          findMany: vi.fn().mockResolvedValue([{ id: 501, customerId: 2 }]),
          updateMany: vi.fn().mockResolvedValue({ count: 8 }),
        },
        deal: {
          findMany: vi.fn().mockResolvedValue([{ id: 7, customerId: 2 }]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        customerAlias: {
          findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 10 }]),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
        $executeRaw: vi.fn().mockResolvedValue(1),
      }
      return fn(tx)
    })

    const res = await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, primaryId: 1, mergedIds: [2] })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("writes audit log for merge", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const auditCreate = vi.fn().mockResolvedValue({ id: 1 })
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        customer: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, name: "Main", taxId: null },
            { id: 2, name: "Dup", taxId: null },
          ]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        document: {
          findMany: vi.fn().mockResolvedValue([{ id: 10, customerId: 2 }]),
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
        deal: {
          findMany: vi.fn().mockResolvedValue([{ id: 20, customerId: 2 }]),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        customerAlias: {
          findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 30 }]),
        },
        auditLog: { create: auditCreate },
        $executeRaw: vi.fn().mockResolvedValue(1),
      }
      return fn(tx)
    })

    await POST(makeReq({ primaryId: 1, duplicateIds: [2] }))

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "customer.merge",
        actorEmail: "admin@sakww.com",
        targetType: "customer",
        targetId: 1,
        metadata: expect.objectContaining({
          mergeVersion: 2,
          undoable: true,
          movedDocuments: [{ id: 10, customerId: 2 }],
          movedDeals: [{ id: 20, customerId: 2 }],
          createdPrimaryAliasIds: [30],
        }),
      }),
    })
  })
})
