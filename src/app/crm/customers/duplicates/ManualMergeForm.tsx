"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type MergePreviewCustomer = {
  id: number
  name: string
  taxId: string | null
  documentCount: number
  dealCount: number
}

type MergePreview = {
  primary: MergePreviewCustomer
  duplicates: MergePreviewCustomer[]
  totals: {
    documentCount: number
    dealCount: number
  }
}

function parseIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export default function ManualMergeForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [mergePayload, setMergePayload] = useState<{ primaryId: number; duplicateIds: number[] } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function getPayload(form: HTMLFormElement) {
    const data = new FormData(form)
    const primaryId = Number(data.get("primaryId"))
    const duplicateIds = parseIds(String(data.get("duplicateIds") ?? "")).filter((id) => id !== primaryId)
    return { primaryId, duplicateIds }
  }

  async function previewMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPreview(null)

    const payload = getPayload(event.currentTarget)

    if (!Number.isInteger(payload.primaryId) || payload.primaryId <= 0 || payload.duplicateIds.length === 0) {
      setError("กรุณาใส่ ID ลูกค้าหลัก และ Duplicate IDs ให้ถูกต้อง")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Preview failed")
      setPreview((await res.json()) as MergePreview)
      setMergePayload(payload)
    } catch {
      setError("ตรวจสอบข้อมูลไม่สำเร็จ กรุณาตรวจสอบ ID แล้วลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  async function merge() {
    if (!mergePayload || !preview) return

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergePayload),
      })
      if (!res.ok) throw new Error("Merge failed")
      setPreview(null)
      setMergePayload(null)
      setConfirmOpen(false)
      toast.success(`merge เข้า #${preview.primary.id} แล้ว`)
      router.refresh()
    } catch {
      setError("รวมลูกค้าไม่สำเร็จ กรุณาตรวจสอบ ID แล้วลองใหม่")
      toast.error("รวมลูกค้าไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={previewMerge} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ลูกค้าหลัก ID</span>
          <Input name="primaryId" inputMode="numeric" placeholder="เช่น 1080" className="h-11 bg-white" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">Duplicate IDs</span>
          <Input name="duplicateIds" placeholder="เช่น 1081, 1082" className="h-11 bg-white" />
        </label>
        <Button type="submit" disabled={loading} className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบก่อน merge"}
        </Button>
        {error ? <p className="text-sm text-red-600 md:col-span-3">{error}</p> : null}
      </form>

      {preview ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--crm-ink)]">Preview merge</h3>
              <p className="mt-1 text-sm text-gray-700">
                ลูกค้าหลัก: {preview.primary.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                #{preview.primary.id} · TAX ID: {preview.primary.taxId ?? "-"} ·{" "}
                {preview.primary.documentCount.toLocaleString("th-TH")} เอกสาร ·{" "}
                {preview.primary.dealCount.toLocaleString("th-TH")} ดีล
              </p>
            </div>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  disabled={loading}
                  className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
                >
                  {loading ? "กำลังรวม..." : "ยืนยัน merge"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>ยืนยัน merge ลูกค้า</DialogTitle>
                  <DialogDescription>
                    รวม {preview.duplicates.length} record เข้า #{preview.primary.id} และย้ายเอกสาร/ดีลทั้งหมดไปที่ลูกค้าหลัก
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={loading}>
                      ยกเลิก
                    </Button>
                  </DialogClose>
                  <Button type="button" onClick={merge} disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
                    {loading ? "กำลังรวม..." : "ยืนยัน merge"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-3 grid gap-2">
            {preview.duplicates.map((customer) => (
              <div key={customer.id} className="rounded-md border border-blue-100 bg-white p-3 text-sm">
                <p className="font-medium text-gray-900">รวมเข้า: {customer.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  #{customer.id} · TAX ID: {customer.taxId ?? "-"} ·{" "}
                  {customer.documentCount.toLocaleString("th-TH")} เอกสาร ·{" "}
                  {customer.dealCount.toLocaleString("th-TH")} ดีล
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm font-medium text-blue-900">
            จะย้าย {preview.totals.documentCount.toLocaleString("th-TH")} เอกสาร และ{" "}
            {preview.totals.dealCount.toLocaleString("th-TH")} ดีล
          </p>
        </div>
      ) : null}
    </div>
  )
}
