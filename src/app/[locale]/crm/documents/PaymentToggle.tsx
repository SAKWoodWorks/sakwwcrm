"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "@/i18n/navigation"
import { MoreHorizontal } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export default function PaymentToggle({
  documentId,
  currentStatus,
}: {
  documentId: number
  currentStatus: string | null
}) {
  const t = useTranslations("Documents.payment")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isPaid = currentStatus === "paid"
  const isPending = currentStatus === "pending"

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isPaid ? "pending" : "paid" }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(isPaid ? t("pendingToast") : t("paidToast"))
      router.refresh()
    } catch {
      toast.error(t("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isPaid ? (
        <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
          {t("paid")}
        </Badge>
      ) : isPending ? (
        <Badge variant="outline" className="border-yellow-200 bg-yellow-100 text-yellow-800">
          {t("pending")}
        </Badge>
      ) : (
        <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-700">
          —
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" disabled={loading} aria-label={t("aria")}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={toggle} variant={isPaid ? "destructive" : "default"}>
            {loading ? t("saving") : isPaid ? t("markPending") : t("markPaid")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
