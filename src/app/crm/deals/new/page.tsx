export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import Link from "next/link"
import DealCreateForm from "../DealCreateForm"

export default async function NewDealPage() {
  const [customers, salespersons] = await Promise.all([
    prisma.customer.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.salesperson.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="crm-page max-w-3xl">
      <div className="mb-4">
        <Link href="/crm/deals" className="text-sm text-blue-600 hover:underline">
          ← ดีล
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="mb-5 text-2xl font-semibold">สร้างดีล</h1>
        <DealCreateForm customers={customers} salespersons={salespersons} />
      </div>
    </div>
  )
}
