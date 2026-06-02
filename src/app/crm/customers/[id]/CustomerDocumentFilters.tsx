"use client"

import { useRef } from "react"

const PAGE_SIZES = [10, 25, 50, 100]

export function CustomerDocumentFilters({
  customerId,
  returnTo,
  docType,
  docPageSize,
  docSort,
}: {
  customerId: number
  returnTo?: string
  docType: string
  docPageSize: number
  docSort: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  function submit() {
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} action={`/crm/customers/${customerId}`} method="get" className="grid gap-2 sm:grid-cols-2">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <input type="hidden" name="docSort" value={docSort} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">ประเภทเอกสาร</span>
        <select
          name="docType"
          defaultValue={docType}
          onChange={submit}
          className="h-10 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          <option value="all">ทั้งหมด</option>
          <option value="tax_invoice">TAX invoice</option>
          <option value="quotation">Quotation</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">ต่อหน้า</span>
        <select
          name="docPageSize"
          defaultValue={String(docPageSize)}
          onChange={submit}
          className="h-10 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} records
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}
