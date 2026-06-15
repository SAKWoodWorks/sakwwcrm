export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { getTranslations } from "next-intl/server"
import SalespersonCreateForm from "./SalespersonCreateForm"

export default async function SalespersonNewPage() {
  const t = await getTranslations("Salespersons")

  return (
    <div className="crm-page max-w-2xl">
      <div className="mb-4">
        <Link href="/crm/salespersons" className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">{t("createForm.title")}</h1>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <SalespersonCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
