"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

type Props = {
  salespersons: { id: number; name: string }[]
}

export default function DocumentFilters({ salespersons }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

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
    <div className="flex flex-wrap gap-3">
      <select
        value={searchParams.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกประเภท</option>
        <option value="tax_invoice">TAX Invoice</option>
        <option value="quotation">Quotation</option>
      </select>

      <select
        value={searchParams.get("channel") ?? ""}
        onChange={(e) => update("channel", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกช่องทาง</option>
        <option value="Web">Web</option>
        <option value="Incall099">Incall099</option>
      </select>

      <select
        value={searchParams.get("salesperson") ?? ""}
        onChange={(e) => update("salesperson", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">ทุกพนักงาน</option>
        {salespersons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => update("from", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />

      <input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => update("to", e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}
