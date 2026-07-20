# Deal Customer Combobox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer `<Select>` in the deal create form with a searchable combobox so users can type to filter the customer list.

**Architecture:** New `CustomerCombobox` client component uses Radix Popover + Input to filter a pre-loaded customer list client-side. A hidden `<input name="customerId">` carries the selected id so the existing form submit logic in `DealCreateForm` needs no changes beyond swapping the element.

**Tech Stack:** Next.js 15, React, TypeScript, Radix UI Popover (already in project), lucide-react (already in project), Tailwind CSS.

---

### Task 1: Create CustomerCombobox component

**Files:**
- Create: `src/app/[locale]/crm/deals/CustomerCombobox.tsx`

- [ ] Create the file with this exact content:

```tsx
"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon } from "lucide-react"

type Customer = { id: number; name: string }

type Props = {
  customers: Customer[]
  noCustomerLabel: string
}

export default function CustomerCombobox({ customers, noCustomerLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedName =
    selectedId != null
      ? (customers.find((c) => c.id === selectedId)?.name ?? noCustomerLabel)
      : noCustomerLabel

  const filtered = query
    ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : customers

  function select(id: number | null) {
    setSelectedId(id)
    setQuery("")
    setOpen(false)
  }

  return (
    <>
      <input type="hidden" name="customerId" value={selectedId ?? "none"} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className={selectedId == null ? "text-muted-foreground" : ""}>
              {selectedName}
            </span>
            <ChevronDownIcon className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="p-2">
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              {noCustomerLabel}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No customers found.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                    selectedId === c.id ? "bg-accent font-medium" : ""
                  }`}
                >
                  {c.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
```

- [ ] Verify TypeScript compiles: `npx tsc --noEmit`
  - Expected: no errors

---

### Task 2: Wire CustomerCombobox into DealCreateForm

**Files:**
- Modify: `src/app/[locale]/crm/deals/DealCreateForm.tsx`

- [ ] Open `DealCreateForm.tsx`. Replace the customer `<Select>` block (lines ~86–99) with `CustomerCombobox`. The final file should look like this — only the customer field section changes, everything else stays identical:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import DatePickerField from "@/components/DatePickerField"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/deals"
import { formatSalespersonName } from "@/lib/salesperson-display"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import CustomerCombobox from "./CustomerCombobox"

type Props = {
  customers: { id: number; name: string }[]
  salespersons: { id: number; name: string }[]
}

export default function DealCreateForm({ customers, salespersons }: Props) {
  const t = useTranslations("Deals")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const customerId = form.get("customerId")
    const salespersonId = form.get("salespersonId")
    const body = {
      title: form.get("title") as string,
      customerId: customerId && customerId !== "none" ? Number(customerId) : null,
      salespersonId: salespersonId && salespersonId !== "none" ? Number(salespersonId) : null,
      stage: form.get("stage") as string,
      expectedValue: form.get("expectedValue") ? Number(form.get("expectedValue")) : null,
      probability: form.get("probability") ? Number(form.get("probability")) : 10,
      expectedCloseDate: (form.get("expectedCloseDate") as string) || null,
      source: (form.get("source") as string) || null,
      notes: (form.get("notes") as string) || null,
    }

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error ?? t("form.createFailed"))
        return
      }
      router.refresh()
      router.push(`/crm/deals/${(json as { id: number }).id}`)
    } catch {
      setError(t("form.createFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.title")}</label>
        <Input name="title" required className="h-11 bg-white" placeholder={t("form.titlePlaceholder")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.customer")}</label>
          <CustomerCombobox customers={customers} noCustomerLabel={t("form.noCustomer")} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.salesperson")}</label>
          <Select name="salespersonId" defaultValue="none">
            <SelectTrigger className="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="none">{t("form.none")}</SelectItem>
            {salespersons.map((salesperson) => (
              <SelectItem key={salesperson.id} value={String(salesperson.id)}>
                {formatSalespersonName(salesperson.name)}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.stage")}</label>
          <Select name="stage" defaultValue="lead">
            <SelectTrigger className="h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            {DEAL_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {DEAL_STAGE_LABELS[stage]}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.expectedValue")}</label>
          <Input name="expectedValue" type="number" min="0" step="0.01" className="h-11 bg-white" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.probability")}</label>
          <Input name="probability" type="number" min="0" max="100" defaultValue="10" className="h-11 bg-white" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.expectedClose")}</label>
          <DatePickerField name="expectedCloseDate" placeholder={t("form.chooseDate")} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("form.source")}</label>
          <Input name="source" className="h-11 bg-white" placeholder="LINE, walk-in, referral" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
        <Textarea name="notes" rows={4} className="bg-white" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]"
        >
          {loading ? t("form.saving") : t("create")}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/crm/deals">{t("form.cancel")}</Link>
        </Button>
      </div>
    </form>
  )
}
```

- [ ] Run TypeScript check: `npx tsc --noEmit`
  - Expected: no errors

- [ ] Run tests: `npm test`
  - Expected: all tests pass (existing deal-create.test.ts tests the API route, not the component — should be unaffected)

- [ ] Commit:

```bash
git add src/app/\[locale\]/crm/deals/CustomerCombobox.tsx src/app/\[locale\]/crm/deals/DealCreateForm.tsx
git commit -m "feat: replace customer select with searchable combobox in deal form"
```

---

### Task 3: Manual verification

- [ ] Open `http://localhost:3000/en/crm/deals/new` in browser
- [ ] Click the customer field — popover opens with search input
- [ ] Type part of a customer name — list filters in real time
- [ ] Select a customer — button shows the selected name, popover closes
- [ ] Submit the form — deal is created with the correct customer linked
- [ ] Create a deal with "No customer linked" (select nothing) — deal creates with `customerId: null`
