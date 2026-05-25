import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const spId = parseInt(id, 10)
  if (isNaN(spId) || String(spId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await prisma.salesperson.update({
      where: { id: spId },
      data: { lineUserId: null, linkCode: null, linkCodeExpiresAt: null },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
