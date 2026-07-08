export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import DealStageBadge from "../DealStageBadge"
import DealStageSelect from "../DealStageSelect"
import { formatSalespersonName } from "@/lib/salesperson-display"
import { formatDealStage } from "@/lib/deals"

type Props = {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  const [t, locale] = await Promise.all([getTranslations("Deals"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const dealId = parseInt(id, 10)
  if (isNaN(dealId) || String(dealId) !== id) notFound()

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      customer: { select: { id: true, name: true, phone: true, province: true } },
      salesperson: { select: { name: true } },
    },
  })

  if (!deal) notFound()

  const expectedValue = Number(deal.expectedValue ?? 0)
  const weighted = (expectedValue * deal.probability) / 100

  return (
    <div className="crm-page max-w-5xl">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/crm/deals" className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
        <DealStageBadge stage={deal.stage} />
      </div>

      <Card className="mb-6 rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{deal.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("detail.updated", { date: deal.updatedAt.toLocaleDateString(localeTag) })}
            </p>
          </div>
          <DealStageSelect dealId={deal.id} currentStage={deal.stage} />
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-4">
          <InfoRow
            label={t("table.customer")}
            value={
              deal.customer ? (
                <Link href={`/crm/customers/${deal.customer.id}`} className="text-blue-600 hover:underline">
                  {deal.customer.name}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <InfoRow label={t("form.salesperson")} value={formatSalespersonName(deal.salesperson?.name, t("unknownSalesperson"))} />
          <InfoRow label={t("detail.source")} value={deal.source ?? "—"} />
          <InfoRow
            label={t("table.expectedClose")}
            value={deal.expectedCloseDate ? deal.expectedCloseDate.toLocaleDateString(localeTag) : "—"}
          />
          <InfoRow label={t("detail.expectedValue")} value={deal.expectedValue != null ? formatMoney(expectedValue, localeTag) : "—"} />
          <InfoRow label={t("detail.probability")} value={`${deal.probability}%`} />
          <InfoRow label={t("metrics.weightedForecast")} value={deal.expectedValue != null ? formatMoney(weighted, localeTag) : "—"} />
          <InfoRow label={t("table.stage")} value={formatDealStage(deal.stage)} />
        </dl>

        {deal.customer && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("detail.customerInfo")}</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
              <InfoRow label={t("detail.province")} value={deal.customer.province ?? "—"} />
              <InfoRow label={t("detail.phone")} value={deal.customer.phone ?? "—"} />
            </dl>
          </div>
        )}

        {deal.notes && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("detail.notes")}</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{deal.notes}</p>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value}</dd>
    </div>
  )
}

function formatMoney(value: number, locale: string) {
  return value.toLocaleString(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
