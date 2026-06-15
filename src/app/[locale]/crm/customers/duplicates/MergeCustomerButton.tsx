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
  primaryId: number
  duplicateIds: number[]
}

export default function MergeCustomerButton({ primaryId, duplicateIds }: Props) {
  const t = useTranslations("CustomerDuplicates.mergeButton")
  const locale = useLocale()
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
      toast.success(t("success", { id: primaryId }))
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
        <Button
          type="button"
          size="sm"
          disabled={loading || duplicateIds.length === 0}
          className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? t("loading") : t("usePrimary", { id: primaryId })}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { id: primaryId, count: duplicateIds.length.toLocaleString(toLocaleTag(locale)) })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" onClick={merge} disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
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
