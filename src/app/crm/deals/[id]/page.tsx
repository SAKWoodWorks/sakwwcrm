export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import DealStageBadge from "../DealStageBadge"
import DealStageSelect from "../DealStageSelect"
import { formatSalespersonName } from "@/lib/salesperson-display"

type Props = {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
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
          ← ดีล
        </Link>
        <DealStageBadge stage={deal.stage} />
      </div>

      <Card className="mb-6 rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{deal.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              อัปเดตล่าสุด {deal.updatedAt.toLocaleDateString("th-TH")}
            </p>
          </div>
          <DealStageSelect dealId={deal.id} currentStage={deal.stage} />
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-4">
          <InfoRow
            label="ลูกค้า"
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
          <InfoRow label="พนักงานขาย" value={formatSalespersonName(deal.salesperson?.name)} />
          <InfoRow label="Source" value={deal.source ?? "—"} />
          <InfoRow
            label="Expected close"
            value={deal.expectedCloseDate ? deal.expectedCloseDate.toLocaleDateString("th-TH") : "—"}
          />
          <InfoRow label="มูลค่าคาดการณ์" value={deal.expectedValue != null ? formatMoney(expectedValue) : "—"} />
          <InfoRow label="โอกาสปิด" value={`${deal.probability}%`} />
          <InfoRow label="Weighted forecast" value={deal.expectedValue != null ? formatMoney(weighted) : "—"} />
          <InfoRow label="Stage" value={deal.stage} />
        </dl>

        {deal.customer && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">ข้อมูลลูกค้า</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
              <InfoRow label="จังหวัด" value={deal.customer.province ?? "—"} />
              <InfoRow label="โทรศัพท์" value={deal.customer.phone ?? "—"} />
            </dl>
          </div>
        )}

        {deal.notes && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Notes</h2>
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

function formatMoney(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}
