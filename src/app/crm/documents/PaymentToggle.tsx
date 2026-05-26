"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function PaymentToggle({
  documentId,
  currentStatus,
}: {
  documentId: number
  currentStatus: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPaid = currentStatus === "paid"

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPaid ? "pending" : "paid" }),
      })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isPaid ? (
        <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
          ชำระแล้ว
        </Badge>
      ) : (
        <Badge variant="outline" className="border-yellow-200 bg-yellow-100 text-yellow-800">
          รอชำระ
        </Badge>
      )}
      {isPaid ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggle}
          disabled={loading}
          className="h-8 border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          {loading ? "..." : "ยกเลิก"}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={toggle}
          disabled={loading}
          className="h-8 bg-[var(--crm-brand)] px-3 text-xs font-semibold text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? "..." : "ทำเครื่องหมายชำระแล้ว"}
        </Button>
      )}
    </div>
  )
}
