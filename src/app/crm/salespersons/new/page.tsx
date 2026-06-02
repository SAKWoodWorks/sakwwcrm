export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import SalespersonCreateForm from "./SalespersonCreateForm"

export default function SalespersonNewPage() {
  return (
    <div className="crm-page max-w-2xl">
      <div className="mb-4">
        <Link href="/crm/salespersons" className="text-sm text-blue-600 hover:underline">
          ← พนักงานขาย
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">เพิ่มพนักงานขาย</h1>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <SalespersonCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}
