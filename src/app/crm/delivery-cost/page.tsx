export const dynamic = "force-dynamic"

import DeliveryCostExplorer from "./DeliveryCostExplorer"
import { getDeliveryCosts } from "@/lib/delivery-costs"

export default function DeliveryCostPage() {
  const rows = getDeliveryCosts()

  return (
    <div className="crm-page">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">Delivery Cost</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            ค่าขนส่งรายจังหวัดจากไฟล์ Delivery.xlsx แยก 4W รถสี่ล้อ และ 6W รถหกล้อ
          </p>
        </div>
      </div>

      <DeliveryCostExplorer rows={rows} />
    </div>
  )
}
