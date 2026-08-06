"use client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

type SalespersonOption = {
  value: string
  label: string
}

const LIMIT_OPTIONS = ["25", "50", "100", "200"] as const

type Props = {
  bucket: string
  salesperson: string
  salespersons: SalespersonOption[]
  limit: string
}

const BUCKETS = ["30_59", "60_89", "90_179", "180_plus"] as const

export default function FollowUpFilters({ bucket, salesperson, salespersons, limit }: Props) {
  const t = useTranslations("FollowUp")
  const router = useRouter()

  function submit(formData: FormData) {
    const params = new URLSearchParams()
    const nextBucket = String(formData.get("bucket") ?? "all")
    const nextSalesperson = String(formData.get("salesperson") ?? "all")
    const nextLimit = String(formData.get("limit") ?? "50")

    if (nextBucket !== "all") params.set("bucket", nextBucket)
    if (nextSalesperson !== "all") params.set("salesperson", nextSalesperson)
    if (nextLimit !== "50") params.set("limit", nextLimit)

    const query = params.toString()
    router.push(query ? `/crm/follow-up?${query}` : "/crm/follow-up")
  }

  return (
    <form action={submit} className="grid gap-3 md:grid-cols-[minmax(10rem,12rem)_minmax(12rem,16rem)_minmax(8rem,10rem)_auto] md:items-end">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{t("filters.bucket")}</span>
        <Select name="bucket" defaultValue={bucket || "all"}>
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allBuckets")}</SelectItem>
            {BUCKETS.map((item) => (
              <SelectItem key={item} value={item}>
                {bucketLabel(item, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{t("filters.salesperson")}</span>
        <Select name="salesperson" defaultValue={salesperson || "all"}>
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allSalespersons")}</SelectItem>
            <SelectItem value="none">{t("filters.noSalesperson")}</SelectItem>
            {salespersons.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{t("filters.perPage")}</span>
        <Select name="limit" defaultValue={limit}>
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Button type="submit" className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
        {t("filters.apply")}
      </Button>
    </form>
  )
}

function bucketLabel(bucket: string, t: ReturnType<typeof useTranslations>) {
  if (bucket === "30_59") return t("summary.days30")
  if (bucket === "60_89") return t("summary.days60")
  if (bucket === "90_179") return t("summary.days90")
  return t("summary.days180")
}
