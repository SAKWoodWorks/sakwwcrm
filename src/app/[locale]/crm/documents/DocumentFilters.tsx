"use client"

import { Input } from "@/components/ui/input"
import DatePickerField from "@/components/DatePickerField"
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
import { useCallback } from "react"

type Props = {
  salespersons: { value: string; label: string }[]
}

export default function DocumentFilters({ salespersons }: Props) {
  const t = useTranslations("Documents.filters")
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryValue = searchParams.get("q") ?? ""

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "all") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      const query = params.toString()
      router.push(query ? `/crm/documents?${query}` : "/crm/documents")
    },
    [router, searchParams]
  )

  return (
    <div className="grid gap-3 md:flex md:flex-wrap">
      <Input
        key={queryValue}
        type="search"
        placeholder={t("searchCustomer")}
        defaultValue={queryValue}
        onKeyDown={(e) => e.key === "Enter" && update("q", e.currentTarget.value)}
        className="h-11 bg-white md:w-64"
      />

      <Select value={searchParams.get("type") ?? "all"} onValueChange={(value) => update("type", value)}>
        <SelectTrigger className="h-11 bg-white md:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allTypes")}</SelectItem>
          <SelectItem value="tax_invoice">TAX Invoice</SelectItem>
          <SelectItem value="quotation">Quotation</SelectItem>
          <SelectItem value="abb_invoice">Abb Invoice</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? "all"} onValueChange={(value) => update("status", value)}>
        <SelectTrigger className="h-11 bg-white md:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allStatuses")}</SelectItem>
          <SelectItem value="paid">{t("paid")}</SelectItem>
          <SelectItem value="pending">{t("pending")}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("channel") ?? "all"} onValueChange={(value) => update("channel", value)}>
        <SelectTrigger className="h-11 bg-white md:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allChannels")}</SelectItem>
          <SelectItem value="Web">Web</SelectItem>
          <SelectItem value="Incall099">Incall099</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("salesperson") ?? "all"} onValueChange={(value) => update("salesperson", value)}>
        <SelectTrigger className="h-11 bg-white md:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("allSalespersons")}</SelectItem>
          {salespersons.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePickerField
        value={searchParams.get("from") ?? ""}
        onChange={(value) => update("from", value)}
        placeholder={t("from")}
        className="md:w-40"
      />

      <DatePickerField
        value={searchParams.get("to") ?? ""}
        onChange={(value) => update("to", value)}
        placeholder={t("to")}
        className="md:w-40"
      />
    </div>
  )
}
