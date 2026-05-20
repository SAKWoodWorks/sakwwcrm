import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

const mockCustomers = [
  {
    id: 1,
    name: "บริษัท เคไอที จำกัด",
    taxId: "0105555012345",
    province: "PTPU",
    type: "dealer",
    status: "active",
    lastPurchaseDate: new Date("2026-05-15"),
    totalSpend: 150000,
  },
]

function CustomerTable({ customers }: { customers: typeof mockCustomers }) {
  return (
    <table>
      <tbody>
        {customers.map((c) => (
          <tr key={c.id}>
            <td>{c.name}</td>
            <td>{c.taxId}</td>
            <td>{c.province}</td>
            <td>{c.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

describe("CustomerTable", () => {
  it("renders customer name and tax id", () => {
    render(<CustomerTable customers={mockCustomers} />)
    expect(screen.getByText("บริษัท เคไอที จำกัด")).toBeInTheDocument()
    expect(screen.getByText("0105555012345")).toBeInTheDocument()
  })

  it("renders province and status", () => {
    render(<CustomerTable customers={mockCustomers} />)
    expect(screen.getByText("PTPU")).toBeInTheDocument()
    expect(screen.getByText("active")).toBeInTheDocument()
  })
})
