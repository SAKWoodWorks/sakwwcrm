import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const status = body?.status
  if (status !== "paid" && status !== "pending") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  await prisma.document.update({
    where: { id: docId },
    data: { paymentStatus: status },
  })

  return NextResponse.json({ ok: true, status })
}
