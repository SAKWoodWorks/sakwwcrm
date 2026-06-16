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
import { useSearchParams } from "next/navigation"

type SalespersonOption = {
  value: string
  label: string
}

type Props = {
  bucket: string
  salesperson: string
  salespersons: SalespersonOption[]
}

const BUCKETS = ["30_59", "60_89", "90_179", "180_plus"] as const

export default function FollowUpFilters({ bucket, salesperson, salespersons }: Props) {
  const t = useTranslations("FollowUp")
  const router = useRouter()
  const searchParams = useSearchParams()

  function submit(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString())
    const nextBucket = String(formData.get("bucket") ?? "all")
    const nextSalesperson = String(formData.get("salesperson") ?? "all")

    if (nextBucket === "all") params.delete("bucket")
    else params.set("bucket", nextBucket)

    if (nextSalesperson === "all") params.delete("salesperson")
    else params.set("salesperson", nextSalesperson)

    const query = params.toString()
    router.push(query ? `/crm/follow-up?${query}` : "/crm/follow-up")
  }

  return (
    <form action={submit} className="grid gap-3 md:grid-cols-[minmax(12rem,14rem)_minmax(12rem,16rem)_auto] md:items-end">
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
