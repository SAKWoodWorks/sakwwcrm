export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DocTypeBadge } from "../DocTypeBadge"
import PaymentToggle from "../PaymentToggle"
import { formatSalespersonName } from "@/lib/salesperson-display"

type Props = {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: Props) {
  const { id } = await params
  const docId = parseInt(id, 10)
  if (isNaN(docId)) notFound()

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      customer: { select: { id: true, name: true } },
      salesperson: { select: { name: true } },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          product: { select: { skuCode: true } },
        },
      },
    },
  })

  if (!doc) notFound()

  const fmt = (n: unknown) =>
    Number(n).toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 0,
    })

  const fmtQty = (n: unknown) =>
    Number(n).toLocaleString("th-TH", { maximumFractionDigits: 3 })

  return (
    <div className="crm-page max-w-6xl">
      {/* Back + title row */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/documents" className="text-sm text-blue-600 hover:underline">
            ← เอกสาร
          </Link>
          <h1 className="text-xl font-semibold font-mono">{doc.docNumber}</h1>
          <DocTypeBadge docType={doc.docType} />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/crm/documents/${doc.id}/edit`}>แก้ไข</Link>
        </Button>
      </div>

      <div className="grid gap-5">
        <Card className="w-full rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
          <CardContent className="p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <MetricCard label="Total" value={doc.total != null ? fmt(doc.total) : "—"} tone="gold" />
              <MetricCard label="วันที่เอกสาร" value={doc.docDate.toLocaleDateString("th-TH")} tone="blue" />
              <MetricCard label="สถานะ" value={doc.docType === "tax_invoice" ? getPaymentLabel(doc.paymentStatus) : "—"} tone="green" />
            </div>
            <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-3">
              <InfoRow label="เลขที่" value={doc.docNumber} />
              <div>
                <dt className="font-medium text-gray-500">ลูกค้า</dt>
                <dd className="mt-0.5">
                  {doc.customer ? (
                    <Link
                      href={`/crm/customers/${doc.customer.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {doc.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <InfoRow label="พนักงาน" value={formatSalespersonName(doc.salesperson?.name)} />
              <InfoRow label="ช่องทาง" value={doc.channel ?? "—"} />
              <InfoRow label="ชื่อไฟล์" value={doc.gdriveFilename ?? "—"} />
              <div>
                <dt className="font-medium text-gray-500">สถานะชำระเงิน</dt>
                <dd className="mt-0.5">
                  {doc.docType === "tax_invoice" ? (
                    <PaymentToggle documentId={doc.id} currentStatus={doc.paymentStatus} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <InfoRow label="Subtotal" value={doc.subtotal != null ? fmt(doc.subtotal) : "—"} />
              <InfoRow label="VAT 7%" value={doc.vat != null ? fmt(doc.vat) : "—"} />
              {doc.refDocNumber ? <InfoRow label="เลขอ้างอิง" value={doc.refDocNumber} /> : null}
            </dl>
            {doc.notes ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <dt className="font-medium text-gray-500">หมายเหตุ</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{doc.notes}</dd>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--crm-ink)]">รายการที่ซื้อ ({doc.items.length})</h2>
          <div className="crm-table-wrap">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-3 py-3 text-gray-500">#</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">รายการ</TableHead>
                <TableHead className="px-3 py-3 text-right text-gray-500">จำนวน</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">หน่วย</TableHead>
                <TableHead className="px-3 py-3 text-right text-gray-500">ราคา/หน่วย</TableHead>
                <TableHead className="px-3 py-3 text-right text-gray-500">รวม</TableHead>
                <TableHead className="px-3 py-3 text-gray-500">SKU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-6 text-center text-gray-400">
                    ไม่มีรายการสินค้า
                  </TableCell>
                </TableRow>
              ) : (
                doc.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="px-3 py-2 tabular-nums text-gray-400">{item.lineNo ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2">{item.description ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">
                      {item.quantity != null ? fmtQty(item.quantity) : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-500">{item.unit ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">
                      {item.unitPrice != null ? fmt(item.unitPrice) : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums font-medium">
                      {item.total != null ? fmt(item.total) : "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2 font-mono text-xs text-gray-400">
                      {item.product?.skuCode ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </section>
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "gold" | "blue" | "green" }) {
  const styles = {
    gold: "border-[#d0aa45] bg-[#fff8dc] text-[#6f4d11]",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone]

  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function getPaymentLabel(status: string | null) {
  if (status === "paid") return "ชำระแล้ว"
  if (status === "pending") return "รอชำระ"
  return "—"
}
