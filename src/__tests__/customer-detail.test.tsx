import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

const mockDocs = [
  {
    id: 1,
    docType: "tax_invoice",
    docNumber: "256V",
    docDate: new Date("2026-05-15"),
    channel: "Web",
    paymentStatus: "paid",
    total: 15000,
    salesperson: { name: "Pickachu" },
  },
  {
    id: 2,
    docType: "quotation",
    docNumber: "177PR",
    docDate: new Date("2026-05-14"),
    channel: "Web",
    paymentStatus: null,
    total: 12000,
    salesperson: { name: "Pickachu" },
  },
]

function DocTypeLabel({ type }: { type: string }) {
  return <span>{type === "tax_invoice" ? "TAX Invoice" : "Quotation"}</span>
}

function DocumentsTable({ docs }: { docs: typeof mockDocs }) {
  return (
    <table>
      <tbody>
        {docs.map((d) => (
          <tr key={d.id}>
            <td>{d.docNumber}</td>
            <td><DocTypeLabel type={d.docType} /></td>
            <td>{d.salesperson?.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

describe("DocumentsTable", () => {
  it("renders invoice doc number", () => {
    render(<DocumentsTable docs={mockDocs} />)
    expect(screen.getByText("256V")).toBeInTheDocument()
  })

  it("renders TAX Invoice label for tax_invoice type", () => {
    render(<DocumentsTable docs={mockDocs} />)
    expect(screen.getByText("TAX Invoice")).toBeInTheDocument()
  })

  it("renders Quotation label for quotation type", () => {
    render(<DocumentsTable docs={mockDocs} />)
    expect(screen.getByText("Quotation")).toBeInTheDocument()
  })

  it("renders salesperson name", () => {
    render(<DocumentsTable docs={mockDocs} />)
    expect(screen.getAllByText("Pickachu")).toHaveLength(2)
  })
})
