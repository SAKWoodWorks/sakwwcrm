"use client"

import { Input } from "@/components/ui/input"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

export default function CustomerSearch() {
  const t = useTranslations("Customers")
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
      const query = params.toString()
      router.push(query ? `/crm/customers?${query}` : "/crm/customers")
    },
    [router, searchParams]
  )

  return (
    <Input
      type="search"
      placeholder={t("search")}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && search(value)}
      className="h-11 w-full bg-white md:w-80"
    />
  )
}
