"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function SalespersonCreateForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const data = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/salespersons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          channel: data.get("channel"),
          active: data.get("active") === "on",
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "เพิ่มพนักงานไม่สำเร็จ")
        return
      }
      router.refresh()
      router.push(`/crm/salespersons/${(json as { id: number }).id}`)
    } catch {
      setError("เพิ่มพนักงานไม่สำเร็จ")
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

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">ชื่อ *</span>
        <Input name="name" required className="h-11 bg-white" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Channel</span>
        <Input name="channel" className="h-11 bg-white" />
      </label>

      <div className="flex items-center gap-2">
        <Checkbox id="active" name="active" defaultChecked />
        <label htmlFor="active" className="text-sm font-medium text-gray-700">
          Active
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? "กำลังบันทึก..." : "เพิ่มพนักงาน"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/crm/salespersons">ยกเลิก</Link>
        </Button>
      </div>
    </form>
  )
}
