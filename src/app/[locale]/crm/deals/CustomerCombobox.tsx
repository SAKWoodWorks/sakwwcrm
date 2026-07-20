"use client"

import { useState } from "react"
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

  const selectedName =
    selectedId !== null
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
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <span className={selectedId === null ? "text-muted-foreground" : ""}>
              {selectedName}
            </span>
            <ChevronDownIcon className="size-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="p-2">
            <Input
              autoFocus
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
