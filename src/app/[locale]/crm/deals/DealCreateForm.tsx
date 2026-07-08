"use client"

import { Button } from "@/components/ui/button"
import DatePickerField from "@/components/DatePickerField"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/deals"
import { formatSalespersonName } from "@/lib/salesperson-display"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

type Props = {
  customers: { id: number; name: string }[]
  salespersons: { id: number; name: string }[]
}

export default function DealCreateForm({ customers, salespersons }: Props) {
  const t = useTranslations("Deals")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const customerId = form.get("customerId")
    const salespersonId = form.get("salespersonId")
    const body = {
      title: form.get("title") as string,
      customerId: customerId && customerId !== "none" ? Number(customerId) : null,
      salespersonId: salespersonId && salespersonId !== "none" ? Number(salespersonId) : null,
      stage: form.get("stage") as string,
      expectedValue: form.get("expectedValue") ? Number(form.get("expectedValue")) : null,
      probability: form.get("probability") ? Number(form.get("probability")) : 10,
      expectedCloseDate: (form.get("expectedCloseDate") as string) || null,
      source: (form.get("source") as string) || null,
      notes: (form.get("notes") as string) || null,
    }

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error ?? t("form.createFailed"))
        return
      }
      router.refresh()
      router.push(`/crm/deals/${(json as { id: number }).id}`)
    } catch {
      setError(t("form.createFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.title")}</label>
        <Input name="title" required className="h-11 bg-white" placeholder={t("form.titlePlaceholder")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.customer")}</label>
          <Select name="customerId" defaultValue="none">
            <SelectTrigger className="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="none">{t("form.noCustomer")}</SelectItem>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={String(customer.id)}>
                {customer.name}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.salesperson")}</label>
          <Select name="salespersonId" defaultValue="none">
            <SelectTrigger className="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="none">{t("form.none")}</SelectItem>
            {salespersons.map((salesperson) => (
              <SelectItem key={salesperson.id} value={String(salesperson.id)}>
                {formatSalespersonName(salesperson.name)}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.stage")}</label>
          <Select name="stage" defaultValue="lead">
            <SelectTrigger className="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            {DEAL_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {DEAL_STAGE_LABELS[stage]}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.expectedValue")}</label>
          <Input name="expectedValue" type="number" min="0" step="0.01" className="h-11 bg-white" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.probability")}</label>
          <Input name="probability" type="number" min="0" max="100" defaultValue="10" className="h-11 bg-white" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.expectedClose")}</label>
          <DatePickerField name="expectedCloseDate" placeholder={t("form.chooseDate")} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.source")}</label>
          <Input name="source" className="h-11 bg-white" placeholder="LINE, walk-in, referral" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <Textarea name="notes" rows={4} className="bg-white" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? t("form.saving") : t("create")}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/crm/deals">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  )
}
