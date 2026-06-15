import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const jobId = parseInt(id, 10)
  if (isNaN(jobId) || String(jobId) !== id) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
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
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  return NextResponse.json({ ok: true, job })
}
