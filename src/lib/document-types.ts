// abb_invoice = tax invoice with blank customer name (produced by the extraction
// pipeline, see extraction/extract_file.py). It carries a real total/payment_status
// and must be treated like tax_invoice everywhere revenue/payment is concerned.
// quotation stays excluded from revenue/analytics.
export const INVOICE_DOC_TYPES: string[] = ["tax_invoice", "abb_invoice"]
