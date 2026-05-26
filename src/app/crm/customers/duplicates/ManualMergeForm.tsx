"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useState } from "react"

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const form = new FormData(event.currentTarget)
    const primaryId = Number(form.get("primaryId"))
    const duplicateIds = parseIds(String(form.get("duplicateIds") ?? "")).filter((id) => id !== primaryId)

    if (!Number.isInteger(primaryId) || primaryId <= 0 || duplicateIds.length === 0) {
      setError("กรุณาใส่ ID ลูกค้าหลัก และ Duplicate IDs ให้ถูกต้อง")
      return
    }

    const ok = confirm(
      `ใช้ #${primaryId} เป็นลูกค้าหลัก? เอกสารและดีลของ ${duplicateIds.map((id) => `#${id}`).join(", ")} จะถูกย้ายเข้าลูกค้านี้`
    )
    if (!ok) return

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, duplicateIds }),
      })
      if (!res.ok) throw new Error("Merge failed")
      router.refresh()
    } catch {
      setError("รวมลูกค้าไม่สำเร็จ กรุณาตรวจสอบ ID แล้วลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ลูกค้าหลัก ID</span>
        <Input name="primaryId" inputMode="numeric" placeholder="เช่น 1080" className="h-11 bg-white" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">Duplicate IDs</span>
        <Input name="duplicateIds" placeholder="เช่น 1081, 1082" className="h-11 bg-white" />
      </label>
      <Button type="submit" disabled={loading} className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
        {loading ? "กำลังรวม..." : "Merge manual"}
      </Button>
      {error ? <p className="text-sm text-red-600 md:col-span-3">{error}</p> : null}
    </form>
  )
}
