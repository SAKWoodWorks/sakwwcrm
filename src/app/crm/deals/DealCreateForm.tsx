"use client"

import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/deals"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  customers: { id: number; name: string }[]
  salespersons: { id: number; name: string }[]
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function DealCreateForm({ customers, salespersons }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const body = {
      title: form.get("title") as string,
      customerId: form.get("customerId") ? Number(form.get("customerId")) : null,
      salespersonId: form.get("salespersonId") ? Number(form.get("salespersonId")) : null,
      stage: form.get("stage") as string,
      expectedValue: form.get("expectedValue") ? Number(form.get("expectedValue")) : null,
      probability: form.get("probability") ? Number(form.get("probability")) : 10,
      expectedCloseDate: (form.get("expectedCloseDate") as string) || null,
      source: (form.get("source") as string) || null,
      notes: (form.get("notes") as string) || null,
    }

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "สร้างดีลไม่สำเร็จ")
        return
      }
      router.refresh()
      router.push(`/crm/deals/${(json as { id: number }).id}`)
    } catch {
      setError("สร้างดีลไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อดีล *</label>
        <input name="title" required className={inputCls} placeholder="เช่น ไม้อัดล็อตใหม่ - บริษัท ABC" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ลูกค้า</label>
          <select name="customerId" className={inputCls}>
            <option value="">ยังไม่ผูกลูกค้า</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">พนักงานขาย</label>
          <select name="salespersonId" className={inputCls}>
            <option value="">ไม่ระบุ</option>
            {salespersons.map((salesperson) => (
              <option key={salesperson.id} value={salesperson.id}>
                {salesperson.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Stage</label>
          <select name="stage" defaultValue="lead" className={inputCls}>
            {DEAL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {DEAL_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">มูลค่าคาดการณ์</label>
          <input name="expectedValue" type="number" min="0" step="0.01" className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">โอกาสปิด (%)</label>
          <input name="probability" type="number" min="0" max="100" defaultValue="10" className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Expected close</label>
          <input name="expectedCloseDate" type="date" className={inputCls} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Source</label>
          <input name="source" className={inputCls} placeholder="LINE, walk-in, referral" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <textarea name="notes" rows={4} className={inputCls} />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "กำลังสร้าง..." : "สร้างดีล"}
        </button>
        <Link
          href="/crm/deals"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  )
}
