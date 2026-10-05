import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

export function formatDate(value: Date | string) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return "—"

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date)
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${valueFor("day")}/${valueFor("month")}/${valueFor("year")}`
}

export function formatDateTime(value: Date | string) {
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return "—"

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
  return `${formatDate(date)} ${time}`
}
