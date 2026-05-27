import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function TopCustomersLoading() {
  return (
    <div className="crm-page">
      <div className="mb-5">
        <Skeleton className="h-8 w-72 bg-blue-100" />
        <Skeleton className="mt-2 h-4 w-full max-w-md bg-blue-50" />
      </div>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Skeleton className="h-16 bg-blue-50" />
          <Skeleton className="h-16 bg-blue-50" />
          <Skeleton className="h-11 bg-blue-100 md:w-28" />
        </div>
      </Card>
      <div className="mt-4 crm-table-wrap">
        <div className="space-y-3 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="grid grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((__, itemIndex) => (
                <Skeleton key={itemIndex} className="h-5 bg-blue-50" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
