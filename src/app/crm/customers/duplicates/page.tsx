export const dynamic = "force-dynamic"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import ManualMergeForm from "./ManualMergeForm"
import MergeCustomerButton from "./MergeCustomerButton"

type DuplicateGroup = {
  group_key: string
  customer_count: bigint
  customer_ids: number[]
  customer_names: string[]
  tax_ids: (string | null)[]
  document_counts: bigint[]
}

export default async function CustomerDuplicatesPage() {
  const [nameGroups, taxIdGroups] = await Promise.all([
    prisma.$queryRaw<DuplicateGroup[]>`
    WITH customer_doc_counts AS (
      SELECT customer_id, COUNT(*) AS document_count
      FROM documents
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id
    ),
    normalized_customers AS (
      SELECT
        c.id,
        c.name,
        c.tax_id,
        COALESCE(dc.document_count, 0) AS document_count,
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(c.name),
              '''?tax\\.?\\s*id\\s*[0-9\\-]+',
              '',
              'g'
            ),
            '(บริษัท|บจก\.?|จำกัด|มหาชน|ห้างหุ้นส่วนจำกัด|หจก\.?|สำนักงานใหญ่|สาขา|\\(|\\)|\\.|,|''|")',
            '',
            'g'
          ),
          '\\s+',
          '',
          'g'
        ) AS group_key
      FROM customers c
      LEFT JOIN customer_doc_counts dc ON dc.customer_id = c.id
    )
    SELECT
      group_key,
      COUNT(*) AS customer_count,
      array_agg(id ORDER BY document_count DESC, id ASC) AS customer_ids,
      array_agg(name ORDER BY document_count DESC, id ASC) AS customer_names,
      array_agg(COALESCE(tax_id, '-') ORDER BY document_count DESC, id ASC) AS tax_ids,
      array_agg(document_count ORDER BY document_count DESC, id ASC) AS document_counts
    FROM normalized_customers
    WHERE length(group_key) >= 3
    GROUP BY group_key
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, group_key ASC
    LIMIT 100
  `,
    prisma.$queryRaw<DuplicateGroup[]>`
    WITH customer_doc_counts AS (
      SELECT customer_id, COUNT(*) AS document_count
      FROM documents
      WHERE customer_id IS NOT NULL
      GROUP BY customer_id
    ),
    tax_customers AS (
      SELECT
        c.id,
        c.name,
        c.tax_id,
        COALESCE(dc.document_count, 0) AS document_count,
        regexp_replace(c.tax_id, '[^0-9]', '', 'g') AS group_key
      FROM customers c
      LEFT JOIN customer_doc_counts dc ON dc.customer_id = c.id
      WHERE c.tax_id IS NOT NULL
        AND regexp_replace(c.tax_id, '[^0-9]', '', 'g') <> ''
    )
    SELECT
      group_key,
      COUNT(*) AS customer_count,
      array_agg(id ORDER BY document_count DESC, id ASC) AS customer_ids,
      array_agg(name ORDER BY document_count DESC, id ASC) AS customer_names,
      array_agg(COALESCE(tax_id, '-') ORDER BY document_count DESC, id ASC) AS tax_ids,
      array_agg(document_count ORDER BY document_count DESC, id ASC) AS document_counts
    FROM tax_customers
    WHERE length(group_key) >= 10
    GROUP BY group_key
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, group_key ASC
    LIMIT 100
  `,
  ])

  return (
    <div className="crm-page max-w-5xl">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">ลูกค้าซ้ำ</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            กลุ่มที่ชื่อใกล้กันหลังตัดคำบริษัท/จำกัด/สำนักงานใหญ่ ใช้ตรวจสอบก่อน merge
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/crm/customers">กลับไปหน้าลูกค้า</Link>
        </Button>
      </div>

      <Card className="mb-4 rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-4">
          <h2 className="text-base font-semibold text-[var(--crm-ink)]">Manual merge</h2>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">
            ใช้เมื่อระบบหา duplicate ไม่เจอเอง ใส่ ID ลูกค้าหลัก และ ID ที่ต้องรวมเข้าไป
          </p>
          <div className="mt-3">
            <ManualMergeForm />
          </div>
        </CardContent>
      </Card>

      <DuplicateSection
        title="ชื่อใกล้กัน"
        emptyText="ยังไม่พบกลุ่มชื่อที่น่าจะซ้ำ"
        groups={nameGroups}
      />

      <div className="mt-6">
        <DuplicateSection
          title="เลขภาษีซ้ำ"
          emptyText="ยังไม่พบกลุ่มเลขภาษีซ้ำ"
          groups={taxIdGroups}
        />
      </div>
    </div>
  )
}

function DuplicateSection({
  title,
  emptyText,
  groups,
}: {
  title: string
  emptyText: string
  groups: DuplicateGroup[]
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-[var(--crm-ink)]">{title}</h2>
      <div className="grid gap-3">
        {groups.length === 0 ? (
          <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
            <CardContent className="p-6 text-sm text-[var(--crm-muted)]">{emptyText}</CardContent>
          </Card>
        ) : (
          groups.map((group, groupIndex) => (
            <Card key={group.group_key} className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-[var(--crm-brand)] ring-1 ring-blue-100">
                      {groupIndex + 1}
                    </div>
                    <div>
                      <h2 className="font-semibold text-[var(--crm-ink)]">{group.group_key}</h2>
                      <p className="text-xs text-[var(--crm-muted)]">{Number(group.customer_count)} records</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-orange-200 bg-orange-100 text-orange-800">
                    ตรวจสอบ
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {group.customer_ids.map((id, index) => (
                    <div
                      key={id}
                      className="grid gap-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm md:grid-cols-[auto_1fr_auto_auto_minmax(12rem,auto)]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-gray-500 ring-1 ring-gray-200">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{group.customer_names[index]}</p>
                        <p className="mt-1 text-xs text-gray-500">TAX ID: {group.tax_ids[index] ?? "-"}</p>
                      </div>
                      <div className="text-xs text-gray-500 md:text-right">
                        {Number(group.document_counts[index] ?? 0).toLocaleString("th-TH")} เอกสาร
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/crm/customers/${id}`}>เปิด #{id}</Link>
                      </Button>
                      <div className="space-y-1">
                        <MergeCustomerButton
                          primaryId={id}
                          duplicateIds={group.customer_ids.filter((otherId) => otherId !== id)}
                        />
                        <p className="text-[11px] text-gray-500">
                          ถ้าใช้ #{id} เป็นลูกค้าหลัก จะรวม {formatIds(group.customer_ids.filter((otherId) => otherId !== id))} เข้าไป
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}

function formatIds(ids: number[]) {
  return ids.map((id) => `#${id}`).join(", ")
}
