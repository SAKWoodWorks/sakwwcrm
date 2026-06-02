import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const name = body.name.trim()
  const existing = await prisma.salesperson.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return NextResponse.json({ error: "Salesperson already exists" }, { status: 409 })

  const salesperson = await prisma.salesperson.create({
    data: {
      name,
      channel: typeof body.channel === "string" && body.channel.trim() ? body.channel.trim() : null,
      active: body.active === true,
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, id: salesperson.id })
}
