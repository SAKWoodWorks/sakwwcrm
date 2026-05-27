import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/auth-bypass", () => ({
  isAuthBypassed: vi.fn(() => false),
}))

vi.mock("child_process", () => ({
  execFile: execFileMock,
  default: {
    execFile: execFileMock,
  },
}))

import { auth } from "@/auth"
import { execFile } from "child_process"
import { POST } from "@/app/api/import/documents/route"

const mockSession = { user: { email: "admin@sakww.com" } } as Awaited<ReturnType<typeof auth>>

function makeReq(file: File): NextRequest {
  const body = new FormData()
  body.set("file", file)
  return { formData: async () => body } as unknown as NextRequest
}

describe("POST /api/import/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(execFile).mockImplementation(((_file, _args, _options, callback) => {
      callback(null, JSON.stringify({
        ok: true,
        results: [{ filename: "invoice.xlsx", ok: true, stdout: "[ok] invoice.xlsx" }],
      }), "")
      return {} as ReturnType<typeof execFile>
    }) as typeof execFile)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const res = await POST(makeReq(new File(["x"], "invoice.xlsx")))

    expect(res.status).toBe(401)
  })

  it("rejects unsupported file types", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const res = await POST(makeReq(new File(["x"], "invoice.txt", { type: "text/plain" })))

    expect(res.status).toBe(400)
  })

  it("imports an xlsx file through the Python upload helper", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const res = await POST(makeReq(new File(["xlsx"], "invoice.xlsx")))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      results: [{ filename: "invoice.xlsx", ok: true, stdout: "[ok] invoice.xlsx" }],
    })
    expect(execFile).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining("import_upload.py"), "--path", expect.stringMatching(/invoice\.xlsx$/)],
      expect.objectContaining({ cwd: expect.stringContaining("extraction") }),
      expect.any(Function)
    )
  })

  it("accepts zip uploads", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const res = await POST(makeReq(new File(["zip"], "docs.zip", { type: "application/zip" })))

    expect(res.status).toBe(200)
    expect(execFile).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining("import_upload.py"), "--path", expect.stringMatching(/docs\.zip$/)],
      expect.any(Object),
      expect.any(Function)
    )
  })
})
