"use client"

import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"

export default function ProductCategoryBadge({ category }: { category: string }) {
  const t = useTranslations("Products.filter")
  const map: Record<string, string> = {
    "Pine Timber": "bg-green-100 text-green-800",
    Rubberwood: "bg-yellow-100 text-yellow-800",
    Teak: "bg-amber-100 text-amber-800",
    teak: "bg-amber-100 text-amber-800",
    ไม้สัก: "bg-amber-100 text-amber-800",
    ไม้สน: "bg-green-100 text-green-800",
    ไม้ยาง: "bg-yellow-100 text-yellow-800",
    bamboo: "bg-lime-100 text-lime-800",
    Bamboo: "bg-lime-100 text-lime-800",
    osb: "bg-orange-100 text-orange-800",
    OSB: "bg-orange-100 text-orange-800",
    อื่นๆ: "bg-gray-100 text-gray-700",
  }
  const labelKeyMap: Record<string, "pine" | "rubberwood" | "teak" | "bamboo" | "osb" | "other"> = {
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
  const cls = map[category] ?? "bg-gray-100 text-gray-700"
  const labelKey = labelKeyMap[category]
  return (
    <Badge variant="outline" className={`border-transparent ${cls}`}>
      {labelKey ? t(labelKey) : category}
    </Badge>
  )
}
