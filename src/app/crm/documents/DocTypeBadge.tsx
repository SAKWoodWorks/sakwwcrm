export function DocTypeBadge({ docType }: { docType: string }) {
  if (docType === "tax_invoice")
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">TAX Invoice</span>
  if (docType === "abb_invoice")
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">Abb Invoice</span>
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Quotation</span>
}
