"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  primaryId: number
  duplicateIds: number[]
}

export default function MergeCustomerButton({ primaryId, duplicateIds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function merge() {
    if (duplicateIds.length === 0) return
    const ok = confirm(
      `ใช้ #${primaryId} เป็นลูกค้าหลัก? เอกสารและดีลของ ${duplicateIds.length} record อื่นจะถูกย้ายเข้าลูกค้านี้`
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
      alert("รวมลูกค้าไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={merge}
      disabled={loading || duplicateIds.length === 0}
      className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
    >
      {loading ? "กำลังรวม..." : `ใช้ #${primaryId} เป็นลูกค้าหลัก`}
    </Button>
  )
}
