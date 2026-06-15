import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const productId = await parseProductId(params)
  if (!productId) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.skuCode !== "string" || !body.skuCode.trim()) {
    return NextResponse.json({ error: "skuCode is required" }, { status: 400 })
  }
  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 })
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        skuCode: body.skuCode.trim(),
        fullName: body.fullName.trim(),
        category: trimOrNull(body.category),
        grade: trimOrNull(body.grade),
        thickness: decimalOrNull(body.thickness),
        width: decimalOrNull(body.width),
        length: decimalOrNull(body.length),
        weight: decimalOrNull(body.weight),
        volume: decimalOrNull(body.volume),
        wsCost: decimalOrNull(body.wsCost),
        rtCost: decimalOrNull(body.rtCost),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return NextResponse.json({ error: "SKU already exists" }, { status: 400 })
      if (err.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const productId = await parseProductId(params)
  if (!productId) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const usedCount = await prisma.documentItem.count({ where: { productId } })
  if (usedCount > 0) {
    return NextResponse.json(
      { error: `สินค้านี้ถูกใช้ในเอกสาร ${usedCount.toLocaleString("th-TH")} รายการ ลบไม่ได้` },
      { status: 400 },
    )
  }

  try {
    await prisma.product.delete({ where: { id: productId } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function parseProductId(params: Promise<{ id: string }>) {
  const { id } = await params
  const productId = parseInt(id, 10)
  if (isNaN(productId) || String(productId) !== id) return null
  return productId
}

function trimOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
