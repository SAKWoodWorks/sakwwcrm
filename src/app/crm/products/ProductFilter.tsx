"use client"

import { useRouter, useSearchParams } from "next/navigation"

const CATEGORIES = [
  { value: "", label: "ทุกประเภท" },
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
    if (value) {
      params.set("category", value)
    } else {
      params.delete("category")
    }
    router.push(`/crm/products?${params.toString()}`)
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {CATEGORIES.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  )
}
