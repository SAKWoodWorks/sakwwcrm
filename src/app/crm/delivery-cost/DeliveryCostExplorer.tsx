"use client"

import { useMemo, useState } from "react"
import { Search, Truck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { selectDeliveryTier, type DeliveryCostRow, type DeliveryVehicle } from "@/lib/delivery-cost-types"

type Props = {
  rows: DeliveryCostRow[]
}

export default function DeliveryCostExplorer({ rows }: Props) {
  const [query, setQuery] = useState("")
  const [vehicle, setVehicle] = useState<DeliveryVehicle>("4w")
  const [amountText, setAmountText] = useState("")

  const amount = parseAmount(amountText)
  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return rows

    return rows.filter((row) =>
      `${row.provinceThai} ${row.provinceEnglish}`.toLowerCase().includes(text),
    )
  }, [query, rows])

  const firstMatch = filteredRows[0]
  const firstTier = firstMatch ? selectDeliveryTier(firstMatch.tiers[vehicle], amount) : null

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ค้นหาจังหวัด</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--crm-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="เช่น กรุงเทพมหานคร, Bangkok"
                className="h-11 rounded-lg border-[var(--crm-line)] bg-white pl-9"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ยอดบิล</span>
            <Input
              inputMode="decimal"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              placeholder="เช่น 25000"
              className="h-11 rounded-lg border-[var(--crm-line)] bg-white"
            />
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">ประเภทรถ</span>
            <div className="grid grid-cols-2 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-brand-soft)] p-1">
              <VehicleButton active={vehicle === "4w"} label="4W" onClick={() => setVehicle("4w")} />
              <VehicleButton active={vehicle === "6w"} label="6W" onClick={() => setVehicle("6w")} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="จังหวัดในไฟล์" value={rows.length.toLocaleString("th-TH")} />
          <Metric label="ผลค้นหา" value={filteredRows.length.toLocaleString("th-TH")} />
          <Metric
            label={firstMatch ? `ตัวอย่าง: ${firstMatch.provinceThai}` : "ค่าขนส่ง"}
            value={firstTier ? formatCost(firstTier.cost) : "ไม่มีข้อมูล"}
            accent
          />
        </div>
      </Card>

      <div className="crm-mobile-list">
        {filteredRows.length === 0 ? (
          <EmptyState />
        ) : (
          filteredRows.map((row) => (
            <DeliveryCard key={`${row.no}-${row.provinceThai}`} row={row} vehicle={vehicle} amount={amount} />
          ))
        )}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">จังหวัด</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ค่าขนส่งที่ใช้</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ช่วงราคา {vehicle.toUpperCase()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-8 text-center text-[var(--crm-muted)]">
                  ไม่พบจังหวัด
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const selectedTier = selectDeliveryTier(row.tiers[vehicle], amount)
                return (
                  <TableRow key={`${row.no}-${row.provinceThai}`} className="align-top hover:bg-gray-50">
                    <TableCell className="px-4 py-3">
                      <p className="font-semibold text-[var(--crm-ink)]">{row.provinceThai}</p>
                      <p className="text-xs text-[var(--crm-muted)]">{row.provinceEnglish}</p>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <p className="text-lg font-bold tabular-nums text-[var(--crm-brand)]">
                        {selectedTier ? formatCost(selectedTier.cost) : "—"}
                      </p>
                      <p className="text-xs text-[var(--crm-muted)]">{selectedTier?.label ?? ""}</p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <TierChips tiers={row.tiers[vehicle]} selectedLabel={selectedTier?.label} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DeliveryCard({ row, vehicle, amount }: { row: DeliveryCostRow; vehicle: DeliveryVehicle; amount: number | null }) {
  const selectedTier = selectDeliveryTier(row.tiers[vehicle], amount)

  return (
    <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--crm-muted)]">#{row.no}</p>
          <h2 className="mt-1 font-semibold text-[var(--crm-ink)]">{row.provinceThai}</h2>
          <p className="text-sm text-[var(--crm-muted)]">{row.provinceEnglish}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-[var(--crm-brand-soft)] px-3 py-2 text-right">
          <p className="text-[11px] font-bold text-[var(--crm-brand)]">{vehicle.toUpperCase()}</p>
          <p className="text-lg font-black tabular-nums text-[var(--crm-brand-dark)]">
            {selectedTier ? formatCost(selectedTier.cost) : "—"}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <TierChips tiers={row.tiers[vehicle]} selectedLabel={selectedTier?.label} />
      </div>
    </Card>
  )
}

function VehicleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--crm-brand)] px-3 text-sm font-bold text-white shadow-sm"
          : "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold text-[var(--crm-brand)]"
      }
    >
      <Truck className="size-4" />
      {label}
    </button>
  )
}

function TierChips({ tiers, selectedLabel }: { tiers: { label: string; cost: number }[]; selectedLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tiers.map((tier) => {
        const selected = tier.label === selectedLabel
        return (
          <span
            key={tier.label}
            className={
              selected
                ? "rounded-md border border-[var(--crm-brand)] bg-[var(--crm-brand-soft)] px-2 py-1 text-xs font-bold text-[var(--crm-brand-dark)]"
                : "rounded-md border border-[var(--crm-line)] bg-white px-2 py-1 text-xs font-medium text-[var(--crm-muted)]"
            }
          >
            {tier.label}: {formatCost(tier.cost)}
          </span>
        )
      })}
    </div>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-lg bg-[var(--crm-brand)] p-3 text-white" : "rounded-lg bg-[var(--crm-brand-soft)] p-3"}>
      <p className={accent ? "text-xs font-medium text-blue-100" : "text-xs font-medium text-[var(--crm-muted)]"}>{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="rounded-lg border-[var(--crm-line)] bg-white p-6 text-center text-sm text-[var(--crm-muted)] shadow-[var(--crm-shadow)]">
      ไม่พบจังหวัด
    </Card>
  )
}

function parseAmount(value: string) {
  const number = Number(value.replaceAll(",", "").trim())
  return Number.isFinite(number) && number >= 0 ? number : null
}

function formatCost(value: number) {
  if (value === 0) return "ฟรี"
  return `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
}
