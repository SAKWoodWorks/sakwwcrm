import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { PATCH } from "@/app/api/customers/[id]/route"

const mockSession = { user: {} } as Awaited<ReturnType<typeof auth>>
const mockCustomer = {} as Awaited<ReturnType<typeof prisma.customer.update>>

const validBody = {
  name: "บริษัท ABC จำกัด",
  taxId: "1234567890123",
  vatRegistered: true,
  type: "dealer",
  status: "active",
  province: "กรุงเทพ",
  address: "123 ถนนสุขุมวิท",
  phone: "021234567",
  email: "abc@example.com",
  lineId: "@abcco",
  salespersonId: null,
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeReq(validBody), makeParams("1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq(validBody), makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id like '1abc'", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq(validBody), makeParams("1abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when name is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const noName = Object.fromEntries(
      Object.entries(validBody).filter(([key]) => key !== "name")
    )
    const res = await PATCH(makeReq(noName), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when name is blank whitespace", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq({ ...validBody, name: "   " }), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("returns 200 and ok:true on success", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.customer.update).mockResolvedValue(mockCustomer)
    const res = await PATCH(makeReq(validBody), makeParams("5"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("calls prisma.customer.update with correct id and trimmed name", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.customer.update).mockResolvedValue(mockCustomer)
    await PATCH(makeReq({ ...validBody, name: "  บริษัท XYZ  " }), makeParams("7"))
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ name: "บริษัท XYZ" }),
      })
    )
  })

  it("returns 400 on P2002 duplicate taxId", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const err = Object.assign(
      new Error("Unique constraint"),
      { code: "P2002", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.customer.update).mockRejectedValue(err)
    const res = await PATCH(makeReq(validBody), makeParams("1"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("TAX ID")
  })

  it("returns 404 on P2025 not found", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const err = Object.assign(
      new Error("Record not found"),
      { code: "P2025", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.customer.update).mockRejectedValue(err)
    const res = await PATCH(makeReq(validBody), makeParams("99"))
    expect(res.status).toBe(404)
  })
})
