import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import ImportPage from "@/app/[locale]/crm/import/page"

function createImportTranslator() {
  return async () => {
    const messages = (await import("../../messages/th.json")).default

    function lookup(key: string) {
      return key.split(".").reduce<unknown>((value, part) => {
        if (value && typeof value === "object" && part in value) {
          return (value as Record<string, unknown>)[part]
        }
        return undefined
      }, messages.Import)
    }

    return (key: string, values?: Record<string, unknown>) => {
      const template = String(lookup(key) ?? key)
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        template,
      )
    }
  }
}

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(createImportTranslator()),
}))

vi.mock("next-intl", async () => {
  const t = await createImportTranslator()()
  return {
    useLocale: () => "th",
    useTranslations: () => t,
  }
})

describe("ImportPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders document import controls", async () => {
    render(await ImportPage())

    expect(screen.getByText("Import เอกสาร")).toBeInTheDocument()
    expect(screen.getByText("เลือกไฟล์ Excel หรือ ZIP ระบบจะสร้าง job แล้วแสดงผลและประวัติ import ให้ติดตาม")).toBeInTheDocument()
    expect(screen.queryByText(/parser Python/)).not.toBeInTheDocument()
    expect(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "เริ่ม import" })).toBeInTheDocument()
  })

  it("uploads selected file, creates job, and renders per-file results", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url === "/api/import/jobs") {
        return new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })
      }
      if (url === "/api/import/documents") {
        return new Response(
          JSON.stringify({
            ok: true,
            job: {
              id: 12,
              filename: "docs.zip",
              status: "completed",
              createdAt: "2026-06-04T00:00:00.000Z",
              result: {
                ok: false,
                skipped: [{ filename: "image.png", reason: "unsupported_type" }],
                results: [
                  { filename: "ok.xlsx", ok: true, stdout: "[ok] ok.xlsx" },
                  { filename: "same.xlsx", ok: true, status: "skipped_existing", stdout: "[skip] already synced: same.xlsx" },
                  { filename: "bad.xlsx", ok: false, stderr: "parse failed" },
                ],
              },
            },
          }),
          { status: 202 },
        )
      }
      return new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })
    })

    render(await ImportPage())
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip"), {
      target: { files: [new File(["x"], "docs.zip", { type: "application/zip" })] },
    })
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม import" }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/import/documents", expect.objectContaining({ method: "POST" })))
    const sentBody = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/import/documents")?.[1]?.body
    expect(sentBody).toBeInstanceOf(FormData)
    expect((sentBody as FormData).get("file")).toBeInstanceOf(File)
    expect(await screen.findByText("ok.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Job #12 · docs.zip")).toBeInTheDocument()
    expect(screen.getByText("นำเข้าใหม่ 1 / 3 ไฟล์ · มีอยู่แล้ว 1 ไฟล์ · ไม่สำเร็จ 1 ไฟล์ · ไม่ใช่ xlsx 1 ไฟล์")).toBeInTheDocument()
    expect(screen.getByText("same.xlsx")).toBeInTheDocument()
    expect(screen.getByText("ข้าม: มีอยู่แล้ว")).toBeInTheDocument()
    expect(screen.getByText("bad.xlsx")).toBeInTheDocument()
    expect(screen.getByText("parse failed")).toBeInTheDocument()
    expect(screen.getByText("ไฟล์ที่ข้าม (1)")).toBeInTheDocument()
    expect(screen.getByText(/image\.png/)).toBeInTheDocument()
    expect(screen.getByText("ข้าม: ไม่ใช่ xlsx")).toBeInTheDocument()
  })

  it("renders import history", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          jobs: [{
            id: 7,
            filename: "old.zip",
            status: "completed",
            createdAt: "2026-06-04T00:00:00.000Z",
            result: {
            ok: false,
            skipped: [{ filename: "image.png", reason: "unsupported_type" }],
            results: [
            { filename: "ok.xlsx", ok: true, stdout: "[ok] ok.xlsx" },
            { filename: "same.xlsx", ok: true, status: "skipped_existing", stdout: "[skip] already synced: same.xlsx" },
              { filename: "bad.xlsx", ok: false, stderr: "parse failed" },
            ],
            },
          }],
        }),
        { status: 200 }
      )
    )

    render(await ImportPage())

    expect(await screen.findByText("ประวัติ import")).toBeInTheDocument()
    expect(await screen.findByText(/#7 · old\.zip/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/#7 · old\.zip/))
    expect(await screen.findByText("ok.xlsx")).toBeInTheDocument()
  })

  it("shows API errors when job creation fails", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url === "/api/import/jobs") return new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })
      return new Response(JSON.stringify({ error: "Python path missing" }), { status: 500 })
    })

    render(await ImportPage())
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ .xlsx หรือ .zip"), {
      target: { files: [new File(["x"], "docs.zip", { type: "application/zip" })] },
    })
    fireEvent.click(screen.getByRole("button", { name: "เริ่ม import" }))

    expect(await screen.findByText("Python path missing")).toBeInTheDocument()
  })
})
