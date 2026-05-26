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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggle}
        disabled={loading}
        className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
      >
        {loading ? "..." : isPaid ? "ยกเลิก" : "ทำเครื่องหมายชำระแล้ว"}
      </Button>
    </div>
  )
}
