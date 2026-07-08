import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { isDealStage } from "@/lib/deals"
import { Prisma } from "@prisma/client"

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const title = optionalString(body?.title)
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 })

  const stage = typeof body?.stage === "string" ? body.stage : "lead"
  if (!isDealStage(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
  }

  const probability = body?.probability === undefined || body?.probability === ""
    ? 10
    : Number(body.probability)
  if (!Number.isInteger(probability) || probability < 0 || probability > 100) {
    return NextResponse.json({ error: "Invalid probability" }, { status: 400 })
  }

  const customerId = optionalNumber(body?.customerId)
  const salespersonId = optionalNumber(body?.salespersonId)
  const expectedValue = optionalNumber(body?.expectedValue)
  if ([customerId, salespersonId, expectedValue].some((value) => Number.isNaN(value))) {
    return NextResponse.json({ error: "Invalid number" }, { status: 400 })
  }

  const expectedCloseDate = optionalString(body?.expectedCloseDate)
  const closeDate = expectedCloseDate ? new Date(expectedCloseDate) : null
  if (expectedCloseDate && Number.isNaN(closeDate?.getTime())) {
    return NextResponse.json({ error: "Invalid close date" }, { status: 400 })
  }

  try {
    const deal = await prisma.deal.create({
      data: {
        title,
        customerId,
        salespersonId,
        stage,
        expectedValue,
        probability,
        expectedCloseDate: closeDate,
        source: optionalString(body?.source),
        notes: optionalString(body?.notes),
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: deal.id })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid customerId or salespersonId" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
