"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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

interface CustomerAliasData {
  id: number
  aliasName: string
  aliasType: string
  taxId: string | null
  note: string | null
}

interface Props {
  customer: CustomerData
  salespersons: { id: number; name: string }[]
  aliases: CustomerAliasData[]
}

export default function CustomerEditForm({ customer, salespersons, aliases }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [aliasLoading, setAliasLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aliasError, setAliasError] = useState<string | null>(null)

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
      salespersonId: data.get("salespersonId") && data.get("salespersonId") !== "none" ? Number(data.get("salespersonId")) : null,
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

  async function handleAddAlias(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAliasError(null)
    setAliasLoading(true)
    const form = e.currentTarget
    const data = new FormData(form)

    try {
      const res = await fetch(`/api/customers/${customer.id}/aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aliasName: data.get("aliasName"),
          taxId: data.get("aliasTaxId"),
          note: data.get("aliasNote"),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setAliasError((json as { error?: string }).error ?? "เพิ่มชื่อเดิมไม่สำเร็จ")
        return
      }
      form.reset()
      router.refresh()
    } catch {
      setAliasError("เพิ่มชื่อเดิมไม่สำเร็จ")
    } finally {
      setAliasLoading(false)
    }
  }

  async function handleDeleteAlias(aliasId: number) {
    setAliasError(null)
    setAliasLoading(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/aliases/${aliasId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setAliasError((json as { error?: string }).error ?? "ลบชื่อเดิมไม่สำเร็จ")
        return
      }
      router.refresh()
    } catch {
      setAliasError("ลบชื่อเดิมไม่สำเร็จ")
    } finally {
      setAliasLoading(false)
    }
  }

  return (
    <div className="space-y-6">
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ *</label>
        <Input name="name" type="text" defaultValue={customer.name} required className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">TAX ID</label>
        <Input name="taxId" type="text" defaultValue={customer.taxId ?? ""} className="h-11 bg-white" />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          name="vatRegistered"
          id="vatRegistered"
          defaultChecked={customer.vatRegistered}
        />
        <label htmlFor="vatRegistered" className="text-sm font-medium text-gray-700">
          จดทะเบียน VAT
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ประเภท</label>
        <Input name="type" type="text" defaultValue={customer.type ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
        <Select name="status" defaultValue={customer.status}>
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_purchase_yet">ยังไม่ซื้อ</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">จังหวัด</label>
        <Input name="province" type="text" defaultValue={customer.province ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ที่อยู่</label>
        <Textarea
          name="address"
          defaultValue={customer.address ?? ""}
          rows={3}
          className="bg-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">โทรศัพท์</label>
        <Input name="phone" type="text" defaultValue={customer.phone ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล</label>
        <Input name="email" type="email" defaultValue={customer.email ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">LINE ID</label>
        <Input name="lineId" type="text" defaultValue={customer.lineId ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Other ID</label>
        <Input name="otherId" type="text" defaultValue={customer.otherId ?? ""} className="h-11 bg-white" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">พนักงานขาย</label>
        <Select name="salespersonId" defaultValue={customer.salespersonId ? String(customer.salespersonId) : "none"}>
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">ไม่ระบุ</SelectItem>
            {salespersons.map((sp) => (
              <SelectItem key={sp.id} value={String(sp.id)}>
                {formatSalespersonName(sp.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button asChild variant="outline">
          <a href={`/crm/customers/${customer.id}`}>ยกเลิก</a>
        </Button>
      </div>
    </form>
    <section className="border-t border-gray-200 pt-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">ชื่อเดิม / ชื่อที่ใช้ค้นหา</h2>
        <p className="mt-1 text-sm text-gray-500">
          ใช้สำหรับชื่อบริษัทเก่า ชื่อย่อ หรือชื่อที่ลูกค้าเคยใช้ค้นหา
        </p>
      </div>

      {aliasError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {aliasError}
        </div>
      )}

      <div className="space-y-2">
        {aliases.length > 0 ? (
          aliases.map((alias) => (
            <div
              key={alias.id}
              className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{alias.aliasName}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {alias.taxId ? `TAX ID: ${alias.taxId}` : "ไม่มี TAX ID"}
                  {alias.note ? ` · ${alias.note}` : ""}
                </p>
              </div>
              <Button
                type="button"
                disabled={aliasLoading}
                onClick={() => handleDeleteAlias(alias.id)}
                variant="outline"
                size="sm"
                className="self-start border-red-200 text-red-700 hover:bg-red-50"
              >
                ลบ
              </Button>
            </div>
          ))
        ) : (
          <Card className="border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
            ยังไม่มีชื่อเดิม
          </Card>
        )}
      </div>

      <form onSubmit={handleAddAlias} className="mt-4 grid gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">เพิ่มชื่อเดิม</label>
          <Input name="aliasName" type="text" required className="h-11 bg-white" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">TAX ID ของชื่อเดิม</label>
            <Input name="aliasTaxId" type="text" className="h-11 bg-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
            <Input name="aliasNote" type="text" placeholder="เช่น ชื่อเก่าก่อนเปลี่ยนบริษัท" className="h-11 bg-white" />
          </div>
        </div>
        <Button
          type="submit"
          disabled={aliasLoading}
          variant="outline"
          className="w-fit border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          {aliasLoading ? "กำลังบันทึก..." : "เพิ่มชื่อเดิม"}
        </Button>
      </form>
    </section>
    </div>
  )
}
