"use client"

import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

export default function CustomerSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get("q") ?? "")

  const search = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (term) {
        params.set("q", term)
      } else {
        params.delete("q")
      }
      params.delete("page")
      router.push(`/crm/customers?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <Input
      type="search"
      placeholder="ค้นหาชื่อลูกค้า หรือ TAX ID..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && search(value)}
      className="h-11 w-full bg-white md:w-80"
    />
  )
}
