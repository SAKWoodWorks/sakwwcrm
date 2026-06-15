"use client"

import { useTranslations } from "next-intl"
import { useRef } from "react"

const PAGE_SIZES = [10, 25, 50, 100]

export function CustomerDocumentFilters({
  returnTo,
  docType,
  docPageSize,
  docSort,
}: {
  returnTo?: string
  docType: string
  docPageSize: number
  docSort: string
}) {
  const t = useTranslations("CustomerDetail.documents.filters")
  const formRef = useRef<HTMLFormElement>(null)

  function submit() {
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} method="get" className="grid gap-2 sm:grid-cols-2">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <input type="hidden" name="docSort" value={docSort} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">{t("docType")}</span>
        <select
          name="docType"
          defaultValue={docType}
          onChange={submit}
          className="h-10 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          <option value="all">{t("all")}</option>
          <option value="tax_invoice">TAX invoice</option>
          <option value="quotation">Quotation</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">{t("perPage")}</span>
        <select
          name="docPageSize"
          defaultValue={String(docPageSize)}
          onChange={submit}
          className="h-10 w-full rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {t("records", { count: size })}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}
