import { Badge } from "@/components/ui/badge"

export function DocTypeBadge({ docType }: { docType: string }) {
  if (docType === "tax_invoice")
    return <Badge variant="outline" className="border-blue-200 bg-blue-100 text-blue-800">TAX Invoice</Badge>
  if (docType === "abb_invoice")
    return <Badge variant="outline" className="border-orange-200 bg-orange-100 text-orange-800">Abb Invoice</Badge>
  return <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-700">Quotation</Badge>
}
