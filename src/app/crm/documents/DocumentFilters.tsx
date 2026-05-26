"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

type Props = {
  salespersons: { value: string; label: string }[]
}

export default function DocumentFilters({ salespersons }: Props) {
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
      router.push(`/crm/documents?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="grid gap-3 md:flex md:flex-wrap">
      <Input
        key={queryValue}
        type="search"
        placeholder="ค้นหาชื่อลูกค้า..."
        defaultValue={queryValue}
        onKeyDown={(e) => e.key === "Enter" && update("q", e.currentTarget.value)}
        className="h-11 bg-white md:w-64"
      />

      <Select value={searchParams.get("type") ?? "all"} onValueChange={(value) => update("type", value)}>
        <SelectTrigger className="h-11 bg-white md:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกประเภท</SelectItem>
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
          <SelectItem value="all">ทุกสถานะ</SelectItem>
          <SelectItem value="paid">ชำระแล้ว</SelectItem>
          <SelectItem value="pending">รอชำระ</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("channel") ?? "all"} onValueChange={(value) => update("channel", value)}>
        <SelectTrigger className="h-11 bg-white md:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกช่องทาง</SelectItem>
          <SelectItem value="Web">Web</SelectItem>
          <SelectItem value="Incall099">Incall099</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("salesperson") ?? "all"} onValueChange={(value) => update("salesperson", value)}>
        <SelectTrigger className="h-11 bg-white md:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกพนักงาน</SelectItem>
          {salespersons.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => update("from", e.target.value)}
        className="h-11 bg-white md:w-40"
      />

      <Input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => update("to", e.target.value)}
        className="h-11 bg-white md:w-40"
      />
    </div>
  )
}
