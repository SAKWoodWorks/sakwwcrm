"use client"

import { formatSalespersonName } from "@/lib/salesperson-display"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface CustomerData {
  id: number
  name: string
  taxId: string | null
  vatRegistered: boolean
  type: string | null
  status: string
  province: string | null
  address: string | null
  phone: string | null
  email: string | null
  lineId: string | null
  otherId: string | null
  salespersonId: number | null
}

interface Props {
  customer: CustomerData
  salespersons: { id: number; name: string }[]
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function CustomerEditForm({ customer, salespersons }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const data = new FormData(form)

    const body = {
      name: data.get("name") as string,
      taxId: (data.get("taxId") as string) || null,
      vatRegistered: data.get("vatRegistered") === "on",
      type: (data.get("type") as string) || null,
      status: data.get("status") as string,
      province: (data.get("province") as string) || null,
      address: (data.get("address") as string) || null,
      phone: (data.get("phone") as string) || null,
      email: (data.get("email") as string) || null,
      lineId: (data.get("lineId") as string) || null,
      otherId: (data.get("otherId") as string) || null,
      salespersonId: data.get("salespersonId") ? Number(data.get("salespersonId")) : null,
    }

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่")
        return
      }
      router.refresh()
      router.push(`/crm/customers/${customer.id}`)
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่")
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
        <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ *</label>
        <input name="name" type="text" defaultValue={customer.name} required className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">TAX ID</label>
        <input name="taxId" type="text" defaultValue={customer.taxId ?? ""} className={inputCls} />
      </div>

      <div className="flex items-center gap-2">
        <input
          name="vatRegistered"
          type="checkbox"
          id="vatRegistered"
          defaultChecked={customer.vatRegistered}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="vatRegistered" className="text-sm font-medium text-gray-700">
          จดทะเบียน VAT
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ประเภท</label>
        <input name="type" type="text" defaultValue={customer.type ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
        <select name="status" defaultValue={customer.status} className={inputCls}>
          <option value="not_purchase_yet">ยังไม่ซื้อ</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">จังหวัด</label>
        <input name="province" type="text" defaultValue={customer.province ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ที่อยู่</label>
        <textarea
          name="address"
          defaultValue={customer.address ?? ""}
          rows={3}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">โทรศัพท์</label>
        <input name="phone" type="text" defaultValue={customer.phone ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล</label>
        <input name="email" type="email" defaultValue={customer.email ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">LINE ID</label>
        <input name="lineId" type="text" defaultValue={customer.lineId ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Other ID</label>
        <input name="otherId" type="text" defaultValue={customer.otherId ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">พนักงานขาย</label>
        <select name="salespersonId" defaultValue={customer.salespersonId ?? ""} className={inputCls}>
          <option value="">ไม่ระบุ</option>
          {salespersons.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {formatSalespersonName(sp.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <a
          href={`/crm/customers/${customer.id}`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
