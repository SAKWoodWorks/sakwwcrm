"use client"

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

const CATEGORIES = [
  { value: "all", labelKey: "all" },
  { value: "ไม้สน", labelKey: "pine" },
  { value: "ไม้ยาง", labelKey: "rubberwood" },
  { value: "bamboo", labelKey: "bamboo" },
  { value: "osb", labelKey: "osb" },
  { value: "อื่นๆ", labelKey: "other" },
] as const

export default function ProductFilter() {
  const t = useTranslations("Products.filter")
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get("category") ?? ""

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") {
      params.set("category", value)
    } else {
      params.delete("category")
    }
    const query = params.toString()
    router.push(query ? `/crm/products?${query}` : "/crm/products")
  }

  return (
    <Select value={current || "all"} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full bg-white md:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {t(c.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
