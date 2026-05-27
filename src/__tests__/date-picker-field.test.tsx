import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import DatePickerField from "@/components/DatePickerField"

describe("DatePickerField", () => {
  it("renders a shadcn date picker button and hidden form value", () => {
    render(<DatePickerField name="from" defaultValue="2026-05-27" />)

    expect(screen.getByRole("button", { name: /27\/05\/2569/ })).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-05-27")).toHaveAttribute("type", "hidden")
  })

  it("shows placeholder when empty", () => {
    render(<DatePickerField placeholder="จากวันที่" />)

    expect(screen.getByRole("button", { name: /จากวันที่/ })).toBeInTheDocument()
  })

  it("renders controlled value", () => {
    const onChange = vi.fn()
    render(<DatePickerField value="2026-05-27" onChange={onChange} />)

    expect(screen.getByRole("button", { name: /27\/05\/2569/ })).toBeInTheDocument()
  })
})
