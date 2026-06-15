import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type MergeMetadata = {
  mergeVersion: number
  undoable: boolean
  undoneAt?: string
  primaryId: number
  mergedIds: number[]
  movedDocuments: Array<{ id: number; customerId: number }>
  movedDeals: Array<{ id: number; customerId: number }>
  createdPrimaryAliasIds: number[]
  duplicateAliases: Array<{
    id: number
    customerId: number
    aliasName: string
    aliasType: string
    taxId: string | null
    note: string | null
    createdAt?: string
  }>
  mergedCustomers: Array<{
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
    createdAt?: string
    updatedAt?: string
  }>
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const auditId = Number(body?.auditId)
  if (!Number.isInteger(auditId) || auditId <= 0)
    return NextResponse.json({ error: "Invalid auditId" }, { status: 400 })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.auditLog.findUnique({ where: { id: auditId } })
      if (!audit || audit.action !== "customer.merge") throw new Error("AUDIT_NOT_FOUND")

      const metadata = parseMergeMetadata(audit.metadata)
      if (!metadata) throw new Error("MERGE_NOT_UNDOABLE")
      if (!metadata.undoable || metadata.undoneAt) throw new Error("MERGE_ALREADY_UNDONE")

      const existingDuplicates = await tx.customer.findMany({
        where: { id: { in: metadata.mergedIds } },
        select: { id: true },
      })
      if (existingDuplicates.length > 0) throw new Error("CUSTOMER_ALREADY_EXISTS")

      for (const customer of metadata.mergedCustomers) {
        await tx.customer.create({
          data: {
            id: customer.id,
            name: customer.name,
            taxId: customer.taxId,
            vatRegistered: customer.vatRegistered ?? true,
            type: customer.type ?? null,
            status: customer.status ?? "not_purchase_yet",
            address: customer.address ?? null,
            province: customer.province ?? null,
            phone: customer.phone ?? null,
            email: customer.email ?? null,
            lineId: customer.lineId ?? null,
            otherId: customer.otherId ?? null,
            salespersonId: customer.salespersonId ?? null,
            createdAt: customer.createdAt ? new Date(customer.createdAt) : undefined,
            updatedAt: customer.updatedAt ? new Date(customer.updatedAt) : undefined,
          },
        })
      }

      for (const customerId of metadata.mergedIds) {
        const documentIds = metadata.movedDocuments
          .filter((doc) => doc.customerId === customerId)
          .map((doc) => doc.id)
        if (documentIds.length > 0) {
          await tx.document.updateMany({
            where: { id: { in: documentIds } },
            data: { customerId },
          })
        }

        const dealIds = metadata.movedDeals
          .filter((deal) => deal.customerId === customerId)
          .map((deal) => deal.id)
        if (dealIds.length > 0) {
          await tx.deal.updateMany({
            where: { id: { in: dealIds } },
            data: { customerId },
          })
        }
      }

      if (metadata.createdPrimaryAliasIds.length > 0) {
        await tx.customerAlias.deleteMany({
          where: {
            id: { in: metadata.createdPrimaryAliasIds },
            customerId: metadata.primaryId,
          },
        })
      }

      for (const alias of metadata.duplicateAliases) {
        await tx.customerAlias.create({
          data: {
            id: alias.id,
            customerId: alias.customerId,
            aliasName: alias.aliasName,
            aliasType: alias.aliasType,
            taxId: alias.taxId,
            note: alias.note,
            createdAt: alias.createdAt ? new Date(alias.createdAt) : undefined,
          },
        })
      }

      const undoneAt = new Date().toISOString()
      await tx.auditLog.update({
        where: { id: auditId },
        data: {
          metadata: {
            ...metadata,
            undoable: false,
            undoneAt,
            undoneBy: session?.user?.email ?? null,
          },
        },
      })
      await tx.auditLog.create({
        data: {
          action: "customer.merge.undo",
          actorEmail: session?.user?.email ?? null,
          targetType: "customer",
          targetId: metadata.primaryId,
          metadata: {
            mergeAuditId: auditId,
            primaryId: metadata.primaryId,
            restoredIds: metadata.mergedIds,
          },
        },
      })

      return { primaryId: metadata.primaryId, restoredIds: metadata.mergedIds }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AUDIT_NOT_FOUND") return NextResponse.json({ error: "Merge audit not found" }, { status: 404 })
      if (error.message === "MERGE_NOT_UNDOABLE") return NextResponse.json({ error: "Merge audit is not undoable" }, { status: 400 })
      if (error.message === "MERGE_ALREADY_UNDONE") return NextResponse.json({ error: "Merge already undone" }, { status: 409 })
      if (error.message === "CUSTOMER_ALREADY_EXISTS") return NextResponse.json({ error: "A restored customer ID already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Undo merge failed" }, { status: 500 })
  }
}

function parseMergeMetadata(value: unknown): MergeMetadata | null {
  if (!value || typeof value !== "object") return null
  const metadata = value as Partial<MergeMetadata>
  if (metadata.mergeVersion !== 2) return null
  if (!Number.isInteger(metadata.primaryId)) return null
  if (!Array.isArray(metadata.mergedIds) || !Array.isArray(metadata.mergedCustomers)) return null
  if (!Array.isArray(metadata.movedDocuments) || !Array.isArray(metadata.movedDeals)) return null
  if (!Array.isArray(metadata.createdPrimaryAliasIds) || !Array.isArray(metadata.duplicateAliases)) return null

  return metadata as MergeMetadata
}
