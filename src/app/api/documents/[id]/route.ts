import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { INVOICE_DOC_TYPES } from "@/lib/document-types"

const VALID_DOC_TYPES = ["tax_invoice", "quotation", "abb_invoice"]
const VALID_PAYMENT_STATUSES = ["paid", "pending", null]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const docId = parseInt(id, 10)
  if (isNaN(docId) || String(docId) !== id) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.docNumber !== "string" || !body.docNumber.trim()) {
    return NextResponse.json({ error: "docNumber is required" }, { status: 400 })
  }
  if (!VALID_DOC_TYPES.includes(body.docType)) return NextResponse.json({ error: "Invalid docType" }, { status: 400 })

  const docDate = parseDate(body.docDate)
  if (!docDate) return NextResponse.json({ error: "Invalid docDate" }, { status: 400 })

  const paymentStatus =
    INVOICE_DOC_TYPES.includes(body.docType) ? normalizePaymentStatus(body.paymentStatus) : null
  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    return NextResponse.json({ error: "Invalid paymentStatus" }, { status: 400 })
  }

  const data = {
    docType: body.docType as string,
    docNumber: body.docNumber.trim(),
    docDate,
    channel: trimOrNull(body.channel),
    salespersonId: idOrNull(body.salespersonId),
    customerId: idOrNull(body.customerId),
    paymentStatus,
    refDocNumber: trimOrNull(body.refDocNumber),
    subtotal: decimalOrNull(body.subtotal),
    vat: decimalOrNull(body.vat),
    total: decimalOrNull(body.total),
    notes: trimOrNull(body.notes),
  }

  try {
    await prisma.document.update({ where: { id: docId }, data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function trimOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function idOrNull(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizePaymentStatus(value: unknown) {
  if (value === "paid" || value === "pending") return value
  return null
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}
