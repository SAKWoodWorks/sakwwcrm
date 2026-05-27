"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Props = {
  name?: string
  value?: string
  defaultValue?: string
  placeholder?: string
  className?: string
  onChange?: (value: string) => void
}

export default function DatePickerField({
  name,
  value,
  defaultValue = "",
  placeholder = "เลือกวันที่",
  className,
  onChange,
}: Props) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const currentValue = isControlled ? value : internalValue
  const selectedDate = parseDateValue(currentValue)

  function selectDate(date?: Date) {
    const nextValue = date ? formatDateValue(date) : ""
    if (!isControlled) setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue ?? ""} readOnly /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            data-empty={!selectedDate}
            className={cn(
              "h-11 w-full justify-start border-[var(--crm-line)] bg-white text-left font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-1.5 size-4" />
            {selectedDate ? formatThaiDate(selectedDate) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={selectDate}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

function parseDateValue(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatThaiDate(date: Date) {
  return date.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}
