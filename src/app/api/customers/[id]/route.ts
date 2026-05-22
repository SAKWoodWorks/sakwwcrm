import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const custId = parseInt(id, 10)
  if (isNaN(custId) || String(custId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== "string" || !body.name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 })

  const data = {
    name: (body.name as string).trim(),
    taxId: (body.taxId as string) || null,
    vatRegistered: body.vatRegistered === true,
    type: (body.type as string) || null,
    status: (body.status as string) || "not_purchase_yet",
    province: (body.province as string) || null,
    address: (body.address as string) || null,
    phone: (body.phone as string) || null,
    email: (body.email as string) || null,
    lineId: (body.lineId as string) || null,
    otherId: (body.otherId as string) || null,
    salespersonId: body.salespersonId ? Number(body.salespersonId) : null,
  }

  const VALID_STATUS = ["not_purchase_yet", "active", "inactive"]
  if (!VALID_STATUS.includes(data.status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  try {
    await prisma.customer.update({ where: { id: custId }, data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return NextResponse.json({ error: "TAX ID ซ้ำกับลูกค้าอื่น" }, { status: 400 })
      if (err.code === "P2025")
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
