import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type AliasRow = {
  id: number
  alias_name: string
  alias_type: string
  tax_id: string | null
  note: string | null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId) || String(customerId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const aliasName = typeof body?.aliasName === "string" ? body.aliasName.trim() : ""
  if (!aliasName) return NextResponse.json({ error: "aliasName is required" }, { status: 400 })

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  })
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  const taxId = typeof body?.taxId === "string" && body.taxId.trim() ? body.taxId.trim() : null
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null

  try {
    const rows = await prisma.$queryRaw<AliasRow[]>`
      INSERT INTO customer_aliases (customer_id, alias_name, alias_type, tax_id, note)
      VALUES (${customerId}, ${aliasName}, 'former_name', ${taxId}, ${note})
      RETURNING id, alias_name, alias_type, tax_id, note
    `
    const alias = rows[0]
    return NextResponse.json({
      ok: true,
      alias: {
        id: alias.id,
        aliasName: alias.alias_name,
        aliasType: alias.alias_type,
        taxId: alias.tax_id,
        note: alias.note,
      },
    })
  } catch {
    return NextResponse.json({ error: "ชื่อเดิมนี้มีอยู่แล้ว หรือบันทึกไม่สำเร็จ" }, { status: 400 })
  }
}
