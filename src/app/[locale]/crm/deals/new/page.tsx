export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import DealCreateForm from "../DealCreateForm"

export default async function NewDealPage() {
  const t = await getTranslations("Deals")
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
          {t("back")}
        </Link>
      </div>

      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <h1 className="mb-5 text-2xl font-semibold">{t("create")}</h1>
          <DealCreateForm customers={customers} salespersons={salespersons} />
        </CardContent>
      </Card>
    </div>
  )
}
