import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type PreviewCustomer = {
  id: number
  name: string
  taxId: string | null
  _count: {
    documents: number
    deals: number
  }
}

function parseDuplicateIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(Number))).filter((id): id is number => Number.isInteger(id) && id > 0)
}

function toPreviewCustomer(customer: PreviewCustomer) {
  return {
    id: customer.id,
    name: customer.name,
    taxId: customer.taxId,
    documentCount: customer._count.documents,
    dealCount: customer._count.deals,
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const primaryId = Number(body?.primaryId)
  const duplicateIds = parseDuplicateIds(body?.duplicateIds)

  if (!Number.isInteger(primaryId) || primaryId <= 0)
    return NextResponse.json({ error: "Invalid primaryId" }, { status: 400 })
  if (duplicateIds.length === 0)
    return NextResponse.json({ error: "duplicateIds is required" }, { status: 400 })
  if (duplicateIds.includes(primaryId))
    return NextResponse.json({ error: "primaryId cannot be merged into itself" }, { status: 400 })

  const ids = [primaryId, ...duplicateIds]
  const customers = (await prisma.customer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      taxId: true,
      _count: {
        select: {
          documents: true,
          deals: true,
        },
      },
    },
  })) as PreviewCustomer[]

  if (customers.length !== ids.length) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  const primary = customers.find((customer) => customer.id === primaryId)
  if (!primary) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  const duplicates = duplicateIds.map((id) => customers.find((customer) => customer.id === id)).filter(Boolean) as PreviewCustomer[]

  return NextResponse.json({
    primary: toPreviewCustomer(primary),
    duplicates: duplicates.map(toPreviewCustomer),
    totals: {
      documentCount: duplicates.reduce((sum, customer) => sum + customer._count.documents, 0),
      dealCount: duplicates.reduce((sum, customer) => sum + customer._count.deals, 0),
    },
  })
}
