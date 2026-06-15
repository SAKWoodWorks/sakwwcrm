export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { getTranslations } from "next-intl/server"
import ImportDocumentForm from "./ImportDocumentForm"

export default async function ImportPage() {
  const t = await getTranslations("Import")

  return (
    <div className="crm-page max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("description")}</p>
      </div>

      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-5">
          <ImportDocumentForm />
        </CardContent>
      </Card>
    </div>
  )
}
