import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const docId = parseInt(id, 10)
  if (isNaN(docId) || String(docId) !== id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const status = body?.status
  if (status !== "paid" && status !== "pending") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  try {
    await prisma.document.update({
      where: { id: docId },
      data: { paymentStatus: status },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status })
}
