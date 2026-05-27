export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DocTypeBadge } from "@/app/crm/documents/DocTypeBadge"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { formatSalespersonName } from "@/lib/salesperson-display"

type Props = {
  params: Promise<{ id: string }>
}

type CustomerAliasRow = {
  alias_name: string
  alias_type: string
  tax_id: string | null
  note: string | null
}

type CustomerMergeAuditRow = {
  actor_email: string | null
  created_at: Date
  metadata: unknown
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) notFound()

  const [customer, aliases, mergeAudits] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesperson: { select: { name: true } },
        documents: {
          orderBy: { docDate: "desc" },
          select: {
            id: true,
            docType: true,
            docNumber: true,
            docDate: true,
            channel: true,
            paymentStatus: true,
            refDocNumber: true,
            subtotal: true,
            vat: true,
            total: true,
            notes: true,
            salesperson: { select: { name: true } },
          },
        },
      },
    }),
    prisma.$queryRaw<CustomerAliasRow[]>`
      SELECT alias_name, alias_type, tax_id, note
      FROM customer_aliases
      WHERE customer_id = ${customerId}
      ORDER BY alias_name ASC
    `,
    getCustomerMergeAudits(customerId),
  ])

  if (!customer) notFound()

  const invoices = customer.documents.filter((d) => d.docType === "tax_invoice")
  const totalSpend = invoices.reduce((sum, d) => sum + Number(d.total ?? 0), 0)
  const lastPurchase = invoices[0]?.docDate
  const salespersonName =
    customer.salesperson?.name ?? customer.documents.find((d) => d.salesperson?.name)?.salesperson?.name

  return (
    <div className="crm-page max-w-5xl">
      <div className="mb-4">
        <Link href="/crm/customers" className="text-sm text-blue-600 hover:underline">
          ← รายชื่อลูกค้า
        </Link>
      </div>

      <Card className="mb-6 rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <Button asChild variant="outline" size="sm">
            <Link href={`/crm/customers/${customer.id}/edit`}>แก้ไข</Link>
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
          <InfoRow label="TAX ID" value={customer.taxId ?? "—"} />
          <InfoRow label="จังหวัด" value={customer.province ?? "—"} />
          <InfoRow label="ประเภท" value={customer.type ?? "—"} />
          <InfoRow label="สถานะ" value={customer.status} />
          <InfoRow label="VAT" value={customer.vatRegistered ? "จดทะเบียน" : "ไม่จดทะเบียน"} />
          <InfoRow label="Salesperson" value={formatSalespersonName(salespersonName)} />
          <InfoRow label="โทรศัพท์" value={customer.phone ?? "—"} />
          <InfoRow label="อีเมล" value={customer.email ?? "—"} />
          <InfoRow label="LINE" value={customer.lineId ?? "—"} />
          <InfoRow label="ที่อยู่" value={customer.address ?? "—"} />
          <InfoRow
            label="ซื้อล่าสุด"
            value={lastPurchase ? lastPurchase.toLocaleDateString("th-TH") : "—"}
          />
          <InfoRow
            label="ยอดซื้อรวม"
            value={totalSpend.toLocaleString("th-TH", {
              style: "currency",
              currency: "THB",
              minimumFractionDigits: 0,
            })}
          />
        </dl>
        {aliases.length > 0 ? (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-700">ชื่อเดิม / ชื่อที่ใช้ค้นหา</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <Badge
                  key={`${alias.alias_type}-${alias.alias_name}`}
                  variant="outline"
                  className="border-blue-100 bg-blue-50 text-blue-800"
                  title={alias.note ?? undefined}
                >
                  {alias.alias_name}
                  {alias.tax_id ? ` (${alias.tax_id})` : ""}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {mergeAudits.length > 0 ? (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-700">ประวัติ merge</h2>
            <div className="mt-2 grid gap-2">
              {mergeAudits.map((audit, index) => {
                const mergedIds = getMergedIds(audit.metadata)
                return (
                  <div
                    key={`${audit.created_at.toISOString()}-${index}`}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600"
                  >
                    <p className="font-medium text-gray-900">
                      รวม {formatMergedIds(mergedIds)} เข้า record นี้
                    </p>
                    <p className="mt-1">{audit.actor_email ?? "ไม่ทราบผู้ใช้"}</p>
                    <p>{audit.created_at.toLocaleString("th-TH")}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">เอกสารทั้งหมด ({customer.documents.length})</h2>
      <div className="crm-table-wrap">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">วันที่</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">เลขที่</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ประเภท</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">ช่องทาง</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">พนักงาน</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">ยอด</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customer.documents.map((d) => (
              <TableRow key={d.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </TableCell>
                <TableCell className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/crm/documents/${d.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {d.docNumber}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <DocTypeBadge docType={d.docType} />
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</TableCell>
                <TableCell className="px-4 py-3">{formatSalespersonName(d.salesperson?.name)}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {d.total != null
                    ? Number(d.total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  {d.docType === "tax_invoice" ? (
                    <PaymentBadge status={d.paymentStatus} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{value}</dd>
    </div>
  )
}

function getMergedIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("mergedIds" in metadata)) return []

  const ids = (metadata as { mergedIds?: unknown }).mergedIds
  if (!Array.isArray(ids)) return []

  return ids.map(Number).filter(Number.isInteger)
}

function formatMergedIds(ids: number[]) {
  if (ids.length === 0) return "record อื่น"
  return ids.map((id) => `#${id}`).join(", ")
}

async function getCustomerMergeAudits(customerId: number) {
  try {
    return await prisma.$queryRaw<CustomerMergeAuditRow[]>`
      SELECT actor_email, created_at, metadata
      FROM audit_logs
      WHERE action = 'customer.merge'
        AND target_type = 'customer'
        AND target_id = ${customerId}
      ORDER BY created_at DESC
      LIMIT 10
    `
  } catch (error) {
    if (isMissingAuditLogsTableError(error)) return []
    throw error
  }
}

function isMissingAuditLogsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const err = error as {
    code?: unknown
    message?: unknown
    meta?: { code?: unknown; message?: unknown }
  }
  const message = `${String(err.message ?? "")} ${String(err.meta?.message ?? "")}`

  return (
    (err.code === "P2010" && err.meta?.code === "42P01" && message.includes("audit_logs")) ||
    (message.includes('relation "audit_logs" does not exist') || message.includes("relation audit_logs does not exist"))
  )
}

function PaymentBadge({ status }: { status: string | null }) {
  if (status === "paid") {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
        ชำระแล้ว
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-yellow-200 bg-yellow-100 text-yellow-800">
      รอชำระ
    </Badge>
  )
}
