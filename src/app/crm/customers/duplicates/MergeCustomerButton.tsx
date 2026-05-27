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
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  primaryId: number
  duplicateIds: number[]
}

export default function MergeCustomerButton({ primaryId, duplicateIds }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function merge() {
    if (duplicateIds.length === 0) return

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, duplicateIds }),
      })
      if (!res.ok) throw new Error("Merge failed")
      toast.success(`รวมลูกค้าเข้า #${primaryId} แล้ว`)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("รวมลูกค้าไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={loading || duplicateIds.length === 0}
          className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? "กำลังรวม..." : `ใช้ #${primaryId} เป็นลูกค้าหลัก`}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยืนยัน merge ลูกค้า</DialogTitle>
          <DialogDescription>
            ใช้ #{primaryId} เป็นลูกค้าหลัก เอกสารและดีลของ {duplicateIds.length} record อื่นจะถูกย้ายเข้าลูกค้านี้
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
  )
}
