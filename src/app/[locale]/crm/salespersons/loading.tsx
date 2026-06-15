import { Card } from "@/components/ui/card"

export default function SalespersonsLoading() {
  return (
    <div className="crm-page">
      <div className="mb-4 h-8 w-40 animate-pulse rounded bg-blue-100" />
      <div className="crm-mobile-list">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
            <div className="h-5 w-36 animate-pulse rounded bg-blue-100" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="h-10 animate-pulse rounded bg-blue-50" />
              <div className="h-10 animate-pulse rounded bg-blue-50" />
              <div className="h-10 animate-pulse rounded bg-blue-50" />
            </div>
          </Card>
        ))}
      </div>
      <div className="crm-table-wrap crm-desktop-table">
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((__, itemIndex) => (
                <div key={itemIndex} className="h-5 animate-pulse rounded bg-blue-50" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
