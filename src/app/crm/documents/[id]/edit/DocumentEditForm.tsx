"use client"

import DatePickerField from "@/components/DatePickerField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { useState } from "react"

type DocumentData = {
  id: number
  docType: string
  docNumber: string
  docDate: string
  channel: string | null
  salespersonId: number | null
  paymentStatus: string | null
  refDocNumber: string | null
  customerId: number | null
  subtotal: string | null
  vat: string | null
  total: string | null
  notes: string | null
}

type Option = { id: number; name: string }

export default function DocumentEditForm({
  document,
  customers,
  salespersons,
}: {
  document: DocumentData
  customers: Option[]
  salespersons: Option[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const data = new FormData(e.currentTarget)

    const body = {
      docType: data.get("docType"),
      docNumber: data.get("docNumber"),
      docDate: data.get("docDate"),
      channel: data.get("channel"),
      salespersonId: data.get("salespersonId"),
      paymentStatus: data.get("paymentStatus"),
      refDocNumber: data.get("refDocNumber"),
      customerId: data.get("customerId"),
      subtotal: data.get("subtotal"),
      vat: data.get("vat"),
      total: data.get("total"),
      notes: data.get("notes"),
    }

    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? "บันทึกเอกสารไม่สำเร็จ")
        return
      }
      router.refresh()
      router.push(`/crm/documents/${document.id}`)
    } catch {
      setError("บันทึกเอกสารไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">ประเภท</span>
          <select name="docType" defaultValue={document.docType} className="h-11 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm">
            <option value="tax_invoice">TAX Invoice</option>
            <option value="quotation">Quotation</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">เลขที่ *</span>
          <Input name="docNumber" defaultValue={document.docNumber} required className="h-11 bg-white" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">วันที่</span>
          <DatePickerField name="docDate" defaultValue={document.docDate} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">ช่องทาง</span>
          <Input name="channel" defaultValue={document.channel ?? ""} className="h-11 bg-white" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">ลูกค้า</span>
          <select name="customerId" defaultValue={document.customerId ? String(document.customerId) : "none"} className="h-11 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm">
            <option value="none">ไม่ระบุ</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">พนักงานขาย</span>
          <select name="salespersonId" defaultValue={document.salespersonId ? String(document.salespersonId) : "none"} className="h-11 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm">
            <option value="none">ไม่ระบุ</option>
            {salespersons.map((salesperson) => (
              <option key={salesperson.id} value={salesperson.id}>{salesperson.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">สถานะชำระเงิน</span>
          <select name="paymentStatus" defaultValue={document.paymentStatus ?? "none"} className="h-11 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm">
            <option value="none">ไม่ระบุ</option>
            <option value="paid">ชำระแล้ว</option>
            <option value="pending">รอชำระ</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">เลขอ้างอิง</span>
          <Input name="refDocNumber" defaultValue={document.refDocNumber ?? ""} className="h-11 bg-white" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AmountInput name="subtotal" label="Subtotal" value={document.subtotal} />
        <AmountInput name="vat" label="VAT" value={document.vat} />
        <AmountInput name="total" label="Total" value={document.total} />
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</span>
        <Textarea name="notes" defaultValue={document.notes ?? ""} rows={4} className="bg-white" />
      </label>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button asChild variant="outline">
          <a href={`/crm/documents/${document.id}`}>ยกเลิก</a>
        </Button>
      </div>
    </form>
  )
}

function AmountInput({ name, label, value }: { name: string; label: string; value: unknown }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <Input name={name} type="number" step="0.01" defaultValue={value != null ? String(value) : ""} className="h-11 bg-white" />
    </label>
  )
}
