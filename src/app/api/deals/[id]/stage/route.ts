import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { isDealStage } from "@/lib/deals"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const dealId = parseInt(id, 10)
  if (isNaN(dealId) || String(dealId) !== id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const stage = body?.stage
  if (!isDealStage(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
  }

  try {
    await prisma.deal.update({
      where: { id: dealId },
      data: { stage },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, stage })
}
