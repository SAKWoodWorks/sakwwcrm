import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

type DocRow = {
  id: number
  docNumber: string
  docDate: Date
  docType: string
  channel: string | null
  total: number | null
  paymentStatus: string | null
  customerName: string
  salespersonName: string | null
}

const mockDocs: DocRow[] = [
  {
    id: 1,
    docNumber: "256V",
    docDate: new Date("2026-05-15"),
    docType: "tax_invoice",
    channel: "Web",
    total: 15000,
    paymentStatus: "paid",
    customerName: "บริษัท เคไอที จำกัด",
    salespersonName: "Pickachu",
  },
  {
    id: 2,
    docNumber: "177PR",
    docDate: new Date("2026-05-14"),
    docType: "quotation",
    channel: "Web",
    total: 12000,
    paymentStatus: null,
    customerName: "คุณภูริ",
    salespersonName: "Pickachu",
  },
]

function DocsTable({ docs }: { docs: DocRow[] }) {
  return (
    <table>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id}>
            <td>{d.docNumber}</td>
            <td>{d.customerName}</td>
            <td>{d.docType === "tax_invoice" ? "TAX Invoice" : "Quotation"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

describe("DocsTable", () => {
  it("renders both documents", () => {
    render(<DocsTable docs={mockDocs} />)
    expect(screen.getByText("256V")).toBeInTheDocument()
    expect(screen.getByText("177PR")).toBeInTheDocument()
  })

  it("renders customer names", () => {
    render(<DocsTable docs={mockDocs} />)
    expect(screen.getByText("บริษัท เคไอที จำกัด")).toBeInTheDocument()
    expect(screen.getByText("คุณภูริ")).toBeInTheDocument()
  })

  it("maps doc type to label", () => {
    render(<DocsTable docs={mockDocs} />)
    expect(screen.getByText("TAX Invoice")).toBeInTheDocument()
    expect(screen.getByText("Quotation")).toBeInTheDocument()
  })
})
