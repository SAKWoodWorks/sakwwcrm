import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      filename: true,
      status: true,
      result: true,
      error: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
    },
  })

  return NextResponse.json({ ok: true, jobs })
}
