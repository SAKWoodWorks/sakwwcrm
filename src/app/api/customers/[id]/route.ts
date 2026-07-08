import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const custId = parseInt(id, 10)
  if (isNaN(custId) || String(custId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== "string" || !body.name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 })

  const data = {
    name: (body.name as string).trim(),
    taxId: typeof body.taxId === "string" && body.taxId.trim() ? body.taxId.trim() : null,
    vatRegistered: body.vatRegistered === true,
    type: typeof body.type === "string" && body.type.trim() ? body.type.trim() : null,
    status: (body.status as string) || "not_purchase_yet",
    province: typeof body.province === "string" && body.province.trim() ? body.province.trim() : null,
    address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
    phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
    email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
    lineId: typeof body.lineId === "string" && body.lineId.trim() ? body.lineId.trim() : null,
    otherId: typeof body.otherId === "string" && body.otherId.trim() ? body.otherId.trim() : null,
    salespersonId: body.salespersonId ? Number(body.salespersonId) : null,
  }

  const VALID_STATUS = ["not_purchase_yet", "active", "inactive"]
  if (!VALID_STATUS.includes(data.status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })

  try {
    await prisma.customer.update({ where: { id: custId }, data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
