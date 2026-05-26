export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
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
      <div className="mb-4 flex items-center gap-4">
        <Link href="/crm/documents" className="text-sm text-blue-600 hover:underline">
          ← เอกสาร
        </Link>
        <h1 className="text-xl font-semibold font-mono">{doc.docNumber}</h1>
        <DocTypeBadge docType={doc.docType} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left: info card */}
        <Card className="w-full shrink-0 rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)] lg:w-72">
          <CardContent className="p-5">
          <dl className="space-y-2 text-sm">
            <InfoRow label="วันที่" value={doc.docDate.toLocaleDateString("th-TH")} />
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
              <dt className="font-medium text-gray-500">สถานะ</dt>
              <dd className="mt-0.5">
                {doc.docType === "tax_invoice" ? (
                  <PaymentToggle documentId={doc.id} currentStatus={doc.paymentStatus} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </dd>
            </div>
            {doc.refDocNumber && (
              <InfoRow label="เลขอ้างอิง" value={doc.refDocNumber} />
            )}
            <div className="border-t border-gray-100 pt-2">
              <InfoRow label="Subtotal" value={doc.subtotal != null ? fmt(doc.subtotal) : "—"} />
              <InfoRow label="VAT 7%" value={doc.vat != null ? fmt(doc.vat) : "—"} />
              <div className="mt-1">
                <dt className="font-medium text-gray-500">Total</dt>
                <dd className="mt-0.5 text-base font-bold text-gray-900">
                  {doc.total != null ? fmt(doc.total) : "—"}
                </dd>
              </div>
            </div>
            {doc.notes && (
              <div className="border-t border-gray-100 pt-2">
                <dt className="font-medium text-gray-500">หมายเหตุ</dt>
                <dd className="mt-0.5 text-gray-700 text-xs whitespace-pre-wrap">{doc.notes}</dd>
              </div>
            )}
          </dl>
          </CardContent>
        </Card>

        {/* Right: items table */}
        <div className="crm-table-wrap flex-1">
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
