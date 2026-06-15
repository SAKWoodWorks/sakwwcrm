export default function DocumentsLoading() {
  return (
    <div className="crm-page">
      <div className="mb-4 h-8 w-32 animate-pulse rounded bg-blue-100" />
      <div className="mb-4 h-24 animate-pulse rounded bg-blue-50" />
      <div className="crm-table-wrap">
        <div className="space-y-3 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="grid grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((__, itemIndex) => (
                <div key={itemIndex} className="h-5 animate-pulse rounded bg-blue-50" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
