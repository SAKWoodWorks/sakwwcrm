import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound")
  }),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const translations: Record<string, string> = {
  "documents.title": "Invoice / Quotation ที่ใช้สินค้านี้ ({count})",
  "documents.all": "ทั้งหมด",
  "documents.invoice": "Invoice",
  "documents.quotation": "Quotation",
  "documents.date": "วันที่",
  "documents.document": "เอกสาร",
  "documents.customer": "ลูกค้า",
  "documents.quantity": "จำนวน",
  "documents.amount": "ยอด",
  "documents.empty": "ยังไม่มีเอกสารที่ผูกกับสินค้านี้",
  "documents.taxInvoice": "TAX Invoice",
  "documents.ariaLabel": "ประเภทเอกสารสินค้า",
  "filter.pine": "ไม้สน",
  "filter.rubberwood": "ไม้ยาง",
  "filter.bamboo": "Bamboo",
  "filter.osb": "OSB",
  "filter.other": "อื่นๆ",
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "th"),
  getTranslations: vi.fn(async () => (key: string, values?: Record<string, unknown>) => {
    const template = translations[key] ?? key
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      template,
    )
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[`filter.${key}`] ?? key,
}))

import { prisma } from "@/lib/prisma"
import ProductDetailPage from "@/app/[locale]/crm/products/[id]/page"

const productFixture = {
  id: 190,
  skuCode: "TTS4S481952400",
  fullName: "Teak KD+S4S Timber",
  category: "Teak",
  grade: null,
  thickness: 48,
  width: 195,
  length: 2.4,
  weight: null,
  volume: null,
  wsCost: null,
  rtCost: 2590,
  dateLastCostAdj: null,
  dateLastInvoice: null,
  totalQtyInvoiced: 0,
  totalAmountInvoiced: 0,
  totalQtyQuoted: 0,
  totalAmountQuoted: 0,
} as Awaited<ReturnType<typeof prisma.product.findUnique>>

const statsFixture = [
  {
    paid_qty: 3,
    paid_amount: 7770,
    paid_invoice_count: BigInt(1),
    quoted_qty: 0,
    quoted_amount: 0,
    quote_count: BigInt(0),
    last_invoice_date: new Date("2026-05-20"),
  },
]

const documentsFixture = [
  {
    document_id: 501,
    doc_number: "185V",
    doc_date: new Date("2026-05-20"),
    doc_type: "tax_invoice",
    payment_status: "paid",
    customer_id: 1080,
    customer_name: "Teak Customer",
    quantity: 3,
    total: 7770,
  },
]

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findUnique).mockResolvedValue(productFixture)
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(statsFixture)
      .mockResolvedValueOnce(documentsFixture)
  })

  it("renders product document filters and keeps the selected invoice filter active", async () => {
    const jsx = await ProductDetailPage({
      params: Promise.resolve({ id: "190" }),
      searchParams: Promise.resolve({ docType: "invoice" }),
    })
    render(jsx)

    expect(screen.getByText("Invoice / Quotation ที่ใช้สินค้านี้ (1)")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ทั้งหมด" })).toHaveAttribute("href", "/crm/products/190")
    expect(screen.getByRole("link", { name: "Invoice" })).toHaveAttribute("href", "/crm/products/190?docType=invoice")
    expect(screen.getByRole("link", { name: "Quotation" })).toHaveAttribute("href", "/crm/products/190?docType=quotation")
    expect(screen.getByRole("link", { name: "Invoice" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("185V")).toBeInTheDocument()
  })
})
