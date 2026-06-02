export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import SalespersonEditForm from "./SalespersonEditForm"

type Props = { params: Promise<{ id: string }> }

export default async function SalespersonEditPage({ params }: Props) {
  const { id } = await params
  const salespersonId = parseInt(id, 10)
  if (isNaN(salespersonId) || String(salespersonId) !== id) notFound()

  const salesperson = await prisma.salesperson.findUnique({
    where: { id: salespersonId },
    select: { id: true, name: true, channel: true, active: true },
  })

  if (!salesperson) notFound()

  return (
    <div className="crm-page max-w-2xl">
      <div className="mb-4">
        <Link href={`/crm/salespersons/${salesperson.id}`} className="text-sm text-blue-600 hover:underline">
          ← {salesperson.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">แก้ไขพนักงานขาย</h1>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <SalespersonEditForm salesperson={salesperson} />
        </CardContent>
      </Card>
    </div>
  )
}
