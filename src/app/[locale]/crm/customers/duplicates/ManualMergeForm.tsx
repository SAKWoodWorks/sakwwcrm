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
import { Input } from "@/components/ui/input"
import { useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

type MergePreviewCustomer = {
  id: number
  name: string
  taxId: string | null
  documentCount: number
  dealCount: number
}

type MergePreview = {
  primary: MergePreviewCustomer
  duplicates: MergePreviewCustomer[]
  totals: {
    documentCount: number
    dealCount: number
  }
}

function parseIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export default function ManualMergeForm() {
  const t = useTranslations("CustomerDuplicates.manualForm")
  const locale = useLocale()
  const localeTag = toLocaleTag(locale)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [mergePayload, setMergePayload] = useState<{ primaryId: number; duplicateIds: number[] } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function getPayload(form: HTMLFormElement) {
    const data = new FormData(form)
    const primaryId = Number(data.get("primaryId"))
    const duplicateIds = parseIds(String(data.get("duplicateIds") ?? "")).filter((id) => id !== primaryId)
    return { primaryId, duplicateIds }
  }

  async function previewMerge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPreview(null)

    const payload = getPayload(event.currentTarget)

    if (!Number.isInteger(payload.primaryId) || payload.primaryId <= 0 || payload.duplicateIds.length === 0) {
      setError(t("errors.invalidIds"))
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Preview failed")
      setPreview((await res.json()) as MergePreview)
      setMergePayload(payload)
    } catch {
      setError(t("errors.previewFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function merge() {
    if (!mergePayload || !preview) return

    setLoading(true)
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergePayload),
      })
      if (!res.ok) throw new Error("Merge failed")
      setPreview(null)
      setMergePayload(null)
      setConfirmOpen(false)
      toast.success(t("success", { id: preview.primary.id }))
      router.refresh()
    } catch {
      setError(t("errors.mergeFailed"))
      toast.error(t("errors.mergeToast"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={previewMerge} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{t("primaryId")}</span>
          <Input name="primaryId" inputMode="numeric" placeholder={t("primaryPlaceholder")} className="h-11 bg-white" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">Duplicate IDs</span>
          <Input name="duplicateIds" placeholder={t("duplicatePlaceholder")} className="h-11 bg-white" />
        </label>
        <Button type="submit" disabled={loading} className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? t("checking") : t("preview")}
        </Button>
        {error ? <p className="text-sm text-red-600 md:col-span-3">{error}</p> : null}
      </form>

      {preview ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--crm-ink)]">{t("previewTitle")}</h3>
              <p className="mt-1 text-sm text-gray-700">
                {t("primaryCustomer", { name: preview.primary.name })}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                #{preview.primary.id} · TAX ID: {preview.primary.taxId ?? "-"} ·{" "}
                {t("documents", { count: preview.primary.documentCount.toLocaleString(localeTag) })} ·{" "}
                {t("deals", { count: preview.primary.dealCount.toLocaleString(localeTag) })}
              </p>
            </div>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  disabled={loading}
                  className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
                >
                  {loading ? t("merging") : t("confirm")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("confirmTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("confirmDescription", { count: preview.duplicates.length.toLocaleString(localeTag), id: preview.primary.id })}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={loading}>
                      {t("cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="button" onClick={merge} disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
                    {loading ? t("merging") : t("confirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-3 grid gap-2">
            {preview.duplicates.map((customer) => (
              <div key={customer.id} className="rounded-md border border-blue-100 bg-white p-3 text-sm">
                <p className="font-medium text-gray-900">{t("mergeInto", { name: customer.name })}</p>
                <p className="mt-1 text-xs text-gray-500">
                  #{customer.id} · TAX ID: {customer.taxId ?? "-"} ·{" "}
                  {t("documents", { count: customer.documentCount.toLocaleString(localeTag) })} ·{" "}
                  {t("deals", { count: customer.dealCount.toLocaleString(localeTag) })}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm font-medium text-blue-900">
            {t("totals", {
              documents: preview.totals.documentCount.toLocaleString(localeTag),
              deals: preview.totals.dealCount.toLocaleString(localeTag),
            })}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
