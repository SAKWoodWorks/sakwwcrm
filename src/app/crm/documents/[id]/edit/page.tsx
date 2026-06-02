export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import DocumentEditForm from "./DocumentEditForm"

type Props = { params: Promise<{ id: string }> }

export default async function DocumentEditPage({ params }: Props) {
  const { id } = await params
  const docId = parseInt(id, 10)
  if (isNaN(docId) || String(docId) !== id) notFound()

  const [document, customers, salespersons] = await Promise.all([
    prisma.document.findUnique({
      where: { id: docId },
      select: {
        id: true,
        docType: true,
        docNumber: true,
        docDate: true,
        channel: true,
        salespersonId: true,
        paymentStatus: true,
        refDocNumber: true,
        customerId: true,
        subtotal: true,
        vat: true,
        total: true,
        notes: true,
      },
    }),
    prisma.customer.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!document) notFound()
  const editDocument = {
    ...document,
    docDate: document.docDate.toISOString().slice(0, 10),
    subtotal: document.subtotal != null ? String(document.subtotal) : null,
    vat: document.vat != null ? String(document.vat) : null,
    total: document.total != null ? String(document.total) : null,
  }

  return (
    <div className="crm-page max-w-3xl">
      <div className="mb-4">
        <Link href={`/crm/documents/${document.id}`} className="text-sm text-blue-600 hover:underline">
          ← {document.docNumber}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">แก้ไขเอกสาร</h1>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <DocumentEditForm document={editDocument} customers={customers} salespersons={salespersons} />
        </CardContent>
      </Card>
    </div>
  )
}
