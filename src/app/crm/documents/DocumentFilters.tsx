"use client"

import { formatSalespersonName } from "@/lib/salesperson-display"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type Props = {
  salespersons: { id: number; name: string }[]
}

export default function DocumentFilters({ salespersons }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nameValue, setNameValue] = useState(searchParams.get("q") ?? "")

  useEffect(() => {
    setNameValue(searchParams.get("q") ?? "")
  }, [searchParams])

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
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
      <input
        type="search"
        placeholder="ค้นหาชื่อลูกค้า..."
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && update("q", nameValue)}
        className="crm-input"
      />

      <select
        value={searchParams.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        className="crm-input"
      >
        <option value="">ทุกประเภท</option>
        <option value="tax_invoice">TAX Invoice</option>
        <option value="quotation">Quotation</option>
        <option value="abb_invoice">Abb Invoice</option>
      </select>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        className="crm-input"
      >
        <option value="">ทุกสถานะ</option>
        <option value="paid">ชำระแล้ว</option>
        <option value="pending">รอชำระ</option>
      </select>

      <select
        value={searchParams.get("channel") ?? ""}
        onChange={(e) => update("channel", e.target.value)}
        className="crm-input"
      >
        <option value="">ทุกช่องทาง</option>
        <option value="Web">Web</option>
        <option value="Incall099">Incall099</option>
      </select>

      <select
        value={searchParams.get("salesperson") ?? ""}
        onChange={(e) => update("salesperson", e.target.value)}
        className="crm-input"
      >
        <option value="">ทุกพนักงาน</option>
        {salespersons.map((s) => (
          <option key={s.id} value={s.id}>
            {formatSalespersonName(s.name)}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => update("from", e.target.value)}
        className="crm-input"
      />

      <input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => update("to", e.target.value)}
        className="crm-input"
      />
    </div>
  )
}
