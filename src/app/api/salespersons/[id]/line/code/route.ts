import { randomInt } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(chars.length)]
  }
  return code
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const spId = parseInt(id, 10)
  if (isNaN(spId) || String(spId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const code = generateCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  try {
    await prisma.salesperson.update({
      where: { id: spId },
      data: { linkCode: code, linkCodeExpiresAt: expiresAt },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ code, expiresAt })
}
