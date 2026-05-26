import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; aliasId: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, aliasId } = await params
  const customerId = parseInt(id, 10)
  const parsedAliasId = parseInt(aliasId, 10)
  if (isNaN(customerId) || String(customerId) !== id || isNaN(parsedAliasId) || String(parsedAliasId) !== aliasId)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const deleted = await prisma.$executeRaw`
    DELETE FROM customer_aliases
    WHERE id = ${parsedAliasId}
      AND customer_id = ${customerId}
  `

  if (deleted === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
