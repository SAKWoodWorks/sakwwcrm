import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function CustomersLoading() {
  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-8 w-28 bg-blue-100" />
        <Skeleton className="h-11 w-full bg-blue-100 md:w-80" />
      </div>
      <LoadingCards />
      <LoadingTable />
    </div>
  )
}

function LoadingCards() {
  return (
    <div className="crm-mobile-list">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
          <Skeleton className="mb-3 h-5 w-3/4 bg-blue-100" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((__, itemIndex) => (
              <Skeleton key={itemIndex} className="h-9 bg-blue-50" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

function LoadingTable() {
  return (
    <div className="crm-table-wrap crm-desktop-table">
      <div className="space-y-3 p-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((__, itemIndex) => (
              <Skeleton key={itemIndex} className="h-5 bg-blue-50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
