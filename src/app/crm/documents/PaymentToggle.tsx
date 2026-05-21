"use client"

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
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          ชำระแล้ว
        </span>
      ) : (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
          รอชำระ
        </span>
      )}
      <button
        onClick={toggle}
        disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 underline-offset-2 hover:underline"
      >
        {loading ? "..." : isPaid ? "ยกเลิก" : "ทำเครื่องหมายชำระแล้ว"}
      </button>
    </div>
  )
}
