import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ImportPage from "@/app/crm/import/page"

describe("ImportPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders document import controls", () => {
    render(<ImportPage />)

    expect(screen.getByText("Import เอกสาร")).toBeInTheDocument()
    expect(screen.getByText("เลือกไฟล์ Excel หรือ ZIP แล้วตรวจผลการนำเข้าได้ทันที")).toBeInTheDocument()
    expect(screen.queryByText(/parser Python/)).not.toBeInTheDocument()
    expect(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "เริ่ม import" })).toBeInTheDocument()
  })

  it("uploads selected file and renders per-file results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          skipped: [{ filename: "image.png", reason: "unsupported_type" }],
          results: [
            { filename: "ok.xlsx", ok: true, stdout: "[ok] ok.xlsx" },
            { filename: "same.xlsx", ok: true, status: "skipped_existing", stdout: "[skip] already synced: same.xlsx" },
            { filename: "bad.xlsx", ok: false, stderr: "parse failed" },
          ],
        }),
        { status: 200 }
      )
    )

    render(<ImportPage />)
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip"), {
      target: { files: [new File(["x"], "docs.zip", { type: "application/zip" })] },
    })
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม import" }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/import/documents", expect.objectContaining({ method: "POST" })))
    const sentBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body
    expect(sentBody).toBeInstanceOf(FormData)
    expect((sentBody as FormData).get("file")).toBeInstanceOf(File)
    expect(await screen.findByText("ok.xlsx")).toBeInTheDocument()
    expect(screen.getByText("same.xlsx")).toBeInTheDocument()
    expect(screen.getByText("ข้าม: มีอยู่แล้ว")).toBeInTheDocument()
    expect(screen.getByText("bad.xlsx")).toBeInTheDocument()
    expect(screen.getByText("parse failed")).toBeInTheDocument()
    expect(screen.getByText("ไฟล์ที่ข้าม (1)")).toBeInTheDocument()
    expect(screen.getByText(/image\.png/)).toBeInTheDocument()
    expect(screen.getByText("ข้าม: ไม่ใช่ xlsx")).toBeInTheDocument()
  })

  it("shows API errors even when response has no results array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Python path missing" }), { status: 500 })
    )

    render(<ImportPage />)
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip"), {
      target: { files: [new File(["x"], "docs.zip", { type: "application/zip" })] },
    })
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม import" }))

    expect(await screen.findByText("Python path missing")).toBeInTheDocument()
    expect(screen.getByText("สำเร็จ 0 / 0 ไฟล์")).toBeInTheDocument()
    expect(screen.getByText("ไม่มีไฟล์ที่ข้าม")).toBeInTheDocument()
  })
})
