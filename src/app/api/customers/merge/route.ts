import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

type MergeCustomer = {
  id: number
  name: string
  taxId: string | null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const primaryId = Number(body?.primaryId)
  const duplicateIds: number[] = Array.isArray(body?.duplicateIds)
    ? Array.from(new Set(body.duplicateIds.map(Number))).filter((id): id is number => Number.isInteger(id))
    : []

  if (!Number.isInteger(primaryId) || primaryId <= 0)
    return NextResponse.json({ error: "Invalid primaryId" }, { status: 400 })
  if (duplicateIds.length === 0)
    return NextResponse.json({ error: "duplicateIds is required" }, { status: 400 })
  if (duplicateIds.includes(primaryId))
    return NextResponse.json({ error: "primaryId cannot be merged into itself" }, { status: 400 })

  try {
    const mergedIds = await prisma.$transaction(async (tx) => {
    const ids = [primaryId, ...duplicateIds]
    const customers = await tx.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, taxId: true },
    })

    if (customers.length !== ids.length) throw new Error("CUSTOMER_NOT_FOUND")

    const duplicates = customers.filter((customer: MergeCustomer) => customer.id !== primaryId)

    for (const duplicate of duplicates) {
      await tx.$executeRaw`
        INSERT INTO customer_aliases (customer_id, alias_name, alias_type, tax_id, note)
        VALUES (${primaryId}, ${duplicate.name}, 'merged_name', ${duplicate.taxId}, ${`Merged from customer #${duplicate.id}`})
        ON CONFLICT DO NOTHING
      `
    }

    await tx.document.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primaryId },
    })
    await tx.deal.updateMany({
      where: { customerId: { in: duplicateIds } },
      data: { customerId: primaryId },
    })
      await tx.$executeRaw`
        INSERT INTO customer_aliases (customer_id, alias_name, alias_type, tax_id, note)
        SELECT ${primaryId}, alias_name, alias_type, tax_id, note
        FROM customer_aliases
        WHERE customer_id IN (${Prisma.join(duplicateIds)})
        ON CONFLICT DO NOTHING
      `
      await tx.$executeRaw`
        DELETE FROM customer_aliases
        WHERE customer_id IN (${Prisma.join(duplicateIds)})
      `
      await tx.customer.deleteMany({
        where: { id: { in: duplicateIds } },
      })
      await tx.auditLog.create({
        data: {
          action: "customer.merge",
          actorEmail: session?.user?.email ?? null,
          targetType: "customer",
          targetId: primaryId,
          metadata: {
            primaryId,
            mergedIds: duplicateIds,
            mergedCustomers: duplicates.map((customer) => ({
              id: customer.id,
              name: customer.name,
              taxId: customer.taxId,
            })),
          },
        },
      })

      return duplicateIds
    })

    return NextResponse.json({ ok: true, primaryId, mergedIds })
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND")
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    return NextResponse.json({ error: "Merge failed" }, { status: 500 })
  }
}
