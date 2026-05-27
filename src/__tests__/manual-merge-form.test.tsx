import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ManualMergeForm from "@/app/crm/customers/duplicates/ManualMergeForm"

const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}))

describe("ManualMergeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("previews customers before manual merge", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          primary: { id: 1, name: "ยู พัซเซิล", taxId: null, documentCount: 10, dealCount: 2 },
          duplicates: [
            {
              id: 2,
              name: "ยู พัซเซิล (สำนักงานใหญ่)",
              taxId: "0100000000000",
              documentCount: 4,
              dealCount: 1,
            },
          ],
          totals: { documentCount: 4, dealCount: 1 },
        }),
        { status: 200 }
      )
    )

    render(<ManualMergeForm />)
    fireEvent.change(screen.getByLabelText("ลูกค้าหลัก ID"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Duplicate IDs"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบก่อน merge" }))

    expect(fetch).toHaveBeenCalledWith("/api/customers/merge/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId: 1, duplicateIds: [2] }),
    })
    expect(await screen.findByText("Preview merge")).toBeInTheDocument()
    expect(screen.getByText("ลูกค้าหลัก: ยู พัซเซิล")).toBeInTheDocument()
    expect(screen.getByText("รวมเข้า: ยู พัซเซิล (สำนักงานใหญ่)")).toBeInTheDocument()
    expect(screen.getByText("จะย้าย 4 เอกสาร และ 1 ดีล")).toBeInTheDocument()
  })

  it("merges from preview after confirmation", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            primary: { id: 1, name: "Main", taxId: null, documentCount: 0, dealCount: 0 },
            duplicates: [{ id: 2, name: "Dup", taxId: null, documentCount: 1, dealCount: 0 }],
            totals: { documentCount: 1, dealCount: 0 },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<ManualMergeForm />)
    fireEvent.change(screen.getByLabelText("ลูกค้าหลัก ID"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Duplicate IDs"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบก่อน merge" }))
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยัน merge" }))
    fireEvent.click(screen.getAllByRole("button", { name: "ยืนยัน merge" }).at(-1)!)

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId: 1, duplicateIds: [2] }),
    }))
    expect(refresh).toHaveBeenCalled()
  })
})
