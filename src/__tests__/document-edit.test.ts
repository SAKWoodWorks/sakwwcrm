import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { PATCH } from "@/app/api/documents/[id]/route"

const mockSession = { user: { email: "test@sakww.com" } } as Awaited<ReturnType<typeof auth>>
const mockDocument = {} as Awaited<ReturnType<typeof prisma.document.update>>

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/documents/5", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const validBody = {
  docType: "tax_invoice",
  docNumber: " TI-001 ",
  docDate: "2026-05-31",
  channel: " LINE ",
  salespersonId: "2",
  customerId: "10",
  paymentStatus: "paid",
  refDocNumber: "",
  subtotal: "1000",
  vat: "70",
  total: "1070",
  notes: " note ",
}

describe("PATCH /api/documents/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeReq(validBody), makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for garbage-prefixed id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq(validBody), makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("requires docNumber", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const res = await PATCH(makeReq({ ...validBody, docNumber: " " }), makeParams("5"))
    expect(res.status).toBe(400)
  })

  it("updates document fields", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument)
    const res = await PATCH(makeReq(validBody), makeParams("5"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({
        docType: "tax_invoice",
        docNumber: "TI-001",
        channel: "LINE",
        salespersonId: 2,
        customerId: 10,
        paymentStatus: "paid",
        subtotal: 1000,
        vat: 70,
        total: 1070,
        notes: "note",
      }),
    })
  })

  it("clears payment status for quotation", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument)
    await PATCH(makeReq({ ...validBody, docType: "quotation", paymentStatus: "paid" }), makeParams("5"))
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: null }),
      }),
    )
  })

  it("accepts abb_invoice docType and keeps payment status like tax_invoice", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.document.update).mockResolvedValue(mockDocument)
    const res = await PATCH(makeReq({ ...validBody, docType: "abb_invoice", paymentStatus: "paid" }), makeParams("5"))

    expect(res.status).toBe(200)
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ docType: "abb_invoice", paymentStatus: "paid" }),
      }),
    )
  })

  it("returns 404 on P2025", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    const err = Object.assign(new Error("Not found"), { code: "P2025", clientVersion: "0.0.0" })
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.document.update).mockRejectedValue(err)
    const res = await PATCH(makeReq(validBody), makeParams("99"))
    expect(res.status).toBe(404)
  })
})
