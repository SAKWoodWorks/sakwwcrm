"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"

const CATEGORIES = [
  { value: "all", label: "ทุกประเภท" },
  { value: "ไม้สน", label: "ไม้สน" },
  { value: "ไม้ยาง", label: "ไม้ยาง" },
  { value: "bamboo", label: "Bamboo" },
  { value: "osb", label: "OSB" },
  { value: "อื่นๆ", label: "อื่นๆ" },
]

export default function ProductFilter() {
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
    router.push(`/crm/products?${params.toString()}`)
  }

  return (
    <Select value={current || "all"} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full bg-white md:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
