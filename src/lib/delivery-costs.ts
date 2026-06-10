import path from "node:path"
import { readFileSync } from "node:fs"
import * as XLSX from "xlsx"
import type { DeliveryCostRow, DeliveryTier, DeliveryVehicle } from "./delivery-cost-types"
export { selectDeliveryTier } from "./delivery-cost-types"

const DELIVERY_FILE = path.join(process.cwd(), "docs", "Delivery.xlsx")
const SHEET_NAME = "Delivery"

const VEHICLE_COLUMNS: Record<DeliveryVehicle, number[]> = {
  "4w": [3, 4, 5, 6, 7, 8, 9],
  "6w": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
}

export function getDeliveryCosts(filePath = DELIVERY_FILE): DeliveryCostRow[] {
  const workbook = XLSX.read(readFileSync(filePath), { type: "buffer", cellDates: false })
  const sheet = workbook.Sheets[SHEET_NAME]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  const headers = rows[0] ?? []

  return rows
    .slice(1)
    .map((row) => parseDeliveryRow(row, headers))
    .filter((row): row is DeliveryCostRow => row !== null)
}

function parseDeliveryRow(
  row: Array<string | number | null>,
  headers: Array<string | number | null>,
): DeliveryCostRow | null {
  const provinceThai = stringValue(row[1])
  if (!provinceThai) return null

  return {
    no: Number(row[0] ?? 0),
    provinceThai,
    provinceEnglish: stringValue(row[2]),
    tiers: {
      "4w": parseVehicleTiers(row, headers, "4w"),
      "6w": parseVehicleTiers(row, headers, "6w"),
    },
  }
}

function parseVehicleTiers(
  row: Array<string | number | null>,
  headers: Array<string | number | null>,
  vehicle: DeliveryVehicle,
) {
  return VEHICLE_COLUMNS[vehicle]
    .map((columnIndex, index) => {
      const cost = numberValue(row[columnIndex])
      if (cost == null) return null

      const header = stringValue(headers[columnIndex])
      const maxAmount = parseMaxAmount(header)
      return {
        label: index === 0 ? "ปกติ" : header,
        maxAmount,
        cost,
      }
    })
    .filter((tier): tier is DeliveryTier => tier !== null)
}

function parseMaxAmount(label: string) {
  const match = label.match(/<\s*([\d,]+)/)
  if (!match) return null
  return Number(match[1].replaceAll(",", ""))
}

function stringValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value).trim()
}

function numberValue(value: string | number | null | undefined) {
  if (value == null || value === "") return null
  const number = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""))
  return Number.isFinite(number) ? number : null
}
