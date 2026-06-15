export const dynamic = "force-dynamic"

import DeliveryCostExplorer from "./DeliveryCostExplorer"
import { getDeliveryCosts } from "@/lib/delivery-costs"
import { getTranslations } from "next-intl/server"

export default async function DeliveryCostPage() {
  const t = await getTranslations("DeliveryCost")
  const rows = await getDeliveryCosts()

  return (
    <div className="crm-page">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("description")}</p>
        </div>
      </div>

      <DeliveryCostExplorer rows={rows} />
    </div>
  )
}
