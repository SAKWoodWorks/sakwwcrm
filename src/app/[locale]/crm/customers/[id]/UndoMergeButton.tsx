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
import { useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

type Props = {
  auditId: number
  restoredIds: number[]
}

export function UndoMergeButton({ auditId, restoredIds }: Props) {
  const t = useTranslations("CustomerDetail.merge.undo")
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function undoMerge() {
    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId }),
      })
      if (!res.ok) throw new Error("Undo failed")

      toast.success(t("success", { count: restoredIds.length.toLocaleString(toLocaleTag(locale)) }))
      setOpen(false)
      router.refresh()
    } catch {
      toast.error(t("error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={loading}>
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { ids: restoredIds.join(", #") })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={undoMerge} disabled={loading} className="bg-red-600 text-white hover:bg-red-700">
            {loading ? t("loading") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
