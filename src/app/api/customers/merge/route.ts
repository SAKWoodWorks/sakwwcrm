import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

type MergeCustomer = {
  id: number
  name: string
  taxId: string | null
  vatRegistered?: boolean
  type?: string | null
  status?: string
  address?: string | null
  province?: string | null
  phone?: string | null
  email?: string | null
  lineId?: string | null
  otherId?: string | null
  salespersonId?: number | null
  createdAt?: Date
  updatedAt?: Date
}

type CustomerMove = {
  id: number
  customerId: number | null
}

type CustomerAliasSnapshot = {
  id: number
  customerId: number
  aliasName: string
  aliasType: string
  taxId: string | null
  note: string | null
  createdAt: Date
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
        select: {
          id: true,
          name: true,
          taxId: true,
          vatRegistered: true,
          type: true,
          status: true,
          address: true,
          province: true,
          phone: true,
          email: true,
          lineId: true,
          otherId: true,
          salespersonId: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (customers.length !== ids.length) throw new Error("CUSTOMER_NOT_FOUND")

      const duplicates = customers.filter((customer: MergeCustomer) => customer.id !== primaryId)
      const movedDocuments = await tx.document.findMany({
        where: { customerId: { in: duplicateIds } },
        select: { id: true, customerId: true },
      })
      const movedDeals = await tx.deal.findMany({
        where: { customerId: { in: duplicateIds } },
        select: { id: true, customerId: true },
      })
      const aliasesBefore = await tx.customerAlias.findMany({
        where: { customerId: { in: ids } },
        select: {
          id: true,
          customerId: true,
          aliasName: true,
          aliasType: true,
          taxId: true,
          note: true,
          createdAt: true,
        },
      })
      const primaryAliasIdsBefore = new Set(
        aliasesBefore
          .filter((alias: CustomerAliasSnapshot) => alias.customerId === primaryId)
          .map((alias: CustomerAliasSnapshot) => alias.id),
      )
      const duplicateAliases = aliasesBefore.filter((alias: CustomerAliasSnapshot) =>
        duplicateIds.includes(alias.customerId),
      )

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
      const primaryAliasesAfter = await tx.customerAlias.findMany({
        where: { customerId: primaryId },
        select: { id: true },
      })
      const createdPrimaryAliasIds = primaryAliasesAfter
        .map((alias: { id: number }) => alias.id)
        .filter((aliasId: number) => !primaryAliasIdsBefore.has(aliasId))

      await tx.auditLog.create({
        data: {
          action: "customer.merge",
          actorEmail: session?.user?.email ?? null,
          targetType: "customer",
          targetId: primaryId,
          metadata: {
            mergeVersion: 2,
            undoable: true,
            primaryId,
            mergedIds: duplicateIds,
            movedDocuments: movedDocuments.map((doc: CustomerMove) => ({
              id: doc.id,
              customerId: doc.customerId,
            })),
            movedDeals: movedDeals.map((deal: CustomerMove) => ({
              id: deal.id,
              customerId: deal.customerId,
            })),
            duplicateAliases: duplicateAliases.map((alias: CustomerAliasSnapshot) => ({
              id: alias.id,
              customerId: alias.customerId,
              aliasName: alias.aliasName,
              aliasType: alias.aliasType,
              taxId: alias.taxId,
              note: alias.note,
              createdAt: alias.createdAt.toISOString(),
            })),
            createdPrimaryAliasIds,
            mergedCustomers: duplicates.map((customer) => ({
              id: customer.id,
              name: customer.name,
              taxId: customer.taxId,
              vatRegistered: customer.vatRegistered,
              type: customer.type,
              status: customer.status,
              address: customer.address,
              province: customer.province,
              phone: customer.phone,
              email: customer.email,
              lineId: customer.lineId,
              otherId: customer.otherId,
              salespersonId: customer.salespersonId,
              createdAt: customer.createdAt?.toISOString(),
              updatedAt: customer.updatedAt?.toISOString(),
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
