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
import { POST } from "@/app/api/customers/merge/undo/route"

const mockSession = { user: { email: "admin@sakww.com" } } as Awaited<ReturnType<typeof auth>>

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/merge/undo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const undoableMetadata = {
  mergeVersion: 2,
  undoable: true,
  primaryId: 1,
  mergedIds: [2],
  movedDocuments: [{ id: 501, customerId: 2 }],
  movedDeals: [{ id: 7, customerId: 2 }],
  createdPrimaryAliasIds: [20, 21],
  duplicateAliases: [
    {
      id: 30,
      customerId: 2,
      aliasName: "Old Dup",
      aliasType: "former_name",
      taxId: null,
      note: null,
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  mergedCustomers: [
    {
      id: 2,
      name: "Dup",
      taxId: null,
      vatRegistered: true,
      status: "active",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    },
  ],
}

describe("POST /api/customers/merge/undo", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await POST(makeReq({ auditId: 1 }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when merge audit has no undo snapshot", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        auditLog: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            action: "customer.merge",
            metadata: { primaryId: 1, mergedIds: [2] },
          }),
        },
      }
      return fn(tx)
    })

    const res = await POST(makeReq({ auditId: 1 }))
    expect(res.status).toBe(400)
  })

  it("restores deleted customers and moves documents/deals back", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const customerCreate = vi.fn().mockResolvedValue({})
    const documentUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const dealUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const aliasDeleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const aliasCreate = vi.fn().mockResolvedValue({})
    const auditUpdate = vi.fn().mockResolvedValue({})
    const auditCreate = vi.fn().mockResolvedValue({})

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        auditLog: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            action: "customer.merge",
            metadata: undoableMetadata,
          }),
          update: auditUpdate,
          create: auditCreate,
        },
        customer: {
          findMany: vi.fn().mockResolvedValue([]),
          create: customerCreate,
        },
        document: { updateMany: documentUpdateMany },
        deal: { updateMany: dealUpdateMany },
        customerAlias: {
          deleteMany: aliasDeleteMany,
          create: aliasCreate,
        },
      }
      return fn(tx)
    })

    const res = await POST(makeReq({ auditId: 1 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, primaryId: 1, restoredIds: [2] })
    expect(customerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 2, name: "Dup" }),
    })
    expect(documentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [501] } },
      data: { customerId: 2 },
    })
    expect(dealUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [7] } },
      data: { customerId: 2 },
    })
    expect(aliasDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [20, 21] }, customerId: 1 },
    })
    expect(aliasCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 30, customerId: 2, aliasName: "Old Dup" }),
    })
    expect(auditUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { metadata: expect.objectContaining({ undoable: false, undoneBy: "admin@sakww.com" }) },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "customer.merge.undo",
        actorEmail: "admin@sakww.com",
        targetId: 1,
      }),
    })
  })
})
