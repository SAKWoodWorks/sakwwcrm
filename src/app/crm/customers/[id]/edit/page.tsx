export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import CustomerEditForm from "../../CustomerEditForm"

type Props = { params: Promise<{ id: string }> }

type CustomerAliasRow = {
  id: number
  alias_name: string
  alias_type: string
  tax_id: string | null
  note: string | null
}

export default async function CustomerEditPage({ params }: Props) {
  const { id } = await params
  const custId = parseInt(id, 10)
  if (isNaN(custId) || String(custId) !== id) notFound()

  const [customer, salespersons, aliasRows] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: custId },
      select: {
        id: true,
        name: true,
        taxId: true,
        vatRegistered: true,
        type: true,
        status: true,
        province: true,
        address: true,
        phone: true,
        email: true,
        lineId: true,
        otherId: true,
        salespersonId: true,
      },
    }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.$queryRaw<CustomerAliasRow[]>`
      SELECT id, alias_name, alias_type, tax_id, note
      FROM customer_aliases
      WHERE customer_id = ${custId}
      ORDER BY alias_name ASC
    `,
  ])

  if (!customer) notFound()

  const aliases = aliasRows.map((alias) => ({
    id: alias.id,
    aliasName: alias.alias_name,
    aliasType: alias.alias_type,
    taxId: alias.tax_id,
    note: alias.note,
  }))

  return (
    <div className="crm-page max-w-2xl">
      <div className="mb-4">
        <Link href={`/crm/customers/${custId}`} className="text-sm text-blue-600 hover:underline">
          ← {customer.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">แก้ไขข้อมูลลูกค้า</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CustomerEditForm customer={customer} salespersons={salespersons} aliases={aliases} />
      </div>
    </div>
  )
}
