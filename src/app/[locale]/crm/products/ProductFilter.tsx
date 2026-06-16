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

type Props = {
  categories: string[]
}

export default function ProductFilter({ categories }: Props) {
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
        <SelectItem value="all">{t("all")}</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {formatCategoryLabel(category, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function formatCategoryLabel(category: string, t: ReturnType<typeof useTranslations>) {
  const labelKeys: Record<string, "pine" | "rubberwood" | "teak" | "bamboo" | "osb" | "other"> = {
    "Pine Timber": "pine",
    Rubberwood: "rubberwood",
    Teak: "teak",
    teak: "teak",
    ไม้สัก: "teak",
    ไม้สน: "pine",
    ไม้ยาง: "rubberwood",
    bamboo: "bamboo",
    Bamboo: "bamboo",
    osb: "osb",
    OSB: "osb",
    อื่นๆ: "other",
  }
  const key = labelKeys[category]
  return key ? t(key) : category
}
