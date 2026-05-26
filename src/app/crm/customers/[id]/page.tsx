export const dynamic = "force-dynamic"

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

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params
  const customerId = parseInt(id, 10)
  if (isNaN(customerId)) notFound()

  const [customer, aliases] = await Promise.all([
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

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <Link
            href={`/crm/customers/${customer.id}/edit`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            แก้ไข
          </Link>
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
                <span
                  key={`${alias.alias_type}-${alias.alias_name}`}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
                  title={alias.note ?? undefined}
                >
                  {alias.alias_name}
                  {alias.tax_id ? ` (${alias.tax_id})` : ""}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <h2 className="mb-3 text-lg font-semibold">เอกสารทั้งหมด ({customer.documents.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">วันที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">เลขที่</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ประเภท</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">ช่องทาง</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">พนักงาน</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">ยอด</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customer.documents.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 tabular-nums">
                  {d.docDate.toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/crm/documents/${d.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {d.docNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {d.docType === "tax_invoice" ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      TAX Invoice
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      Quotation
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{d.channel ?? "—"}</td>
                <td className="px-4 py-3">{formatSalespersonName(d.salesperson?.name)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.total != null
                    ? Number(d.total).toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                        minimumFractionDigits: 0,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {d.docType === "tax_invoice" ? (
                    <PaymentBadge status={d.paymentStatus} />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function PaymentBadge({ status }: { status: string | null }) {
  if (status === "paid") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        ชำระแล้ว
      </span>
    )
  }
  return (
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
      รอชำระ
    </span>
  )
}
