export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import ImportDocumentForm from "./ImportDocumentForm"

export default function ImportPage() {
  return (
    <div className="crm-page max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">Import เอกสาร</h1>
        <p className="mt-1 text-sm text-[var(--crm-muted)]">
          เลือกไฟล์ Excel หรือ ZIP แล้วตรวจผลการนำเข้าได้ทันที
        </p>
      </div>

      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-5">
          <ImportDocumentForm />
        </CardContent>
      </Card>
    </div>
  )
}
