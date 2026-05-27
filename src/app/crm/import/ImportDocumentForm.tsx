"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRef, useState } from "react"

type ImportResult = {
  filename: string
  ok: boolean
  status?: "imported" | "skipped_existing" | "failed"
  stdout?: string
  stderr?: string
}

type SkippedImportFile = {
  filename: string
  reason: "unsupported_type" | string
}

type ImportResponse = {
  ok: boolean
  results: ImportResult[]
  skipped?: SkippedImportFile[]
  error?: string
}

function normalizeImportResponse(value: unknown): ImportResponse {
  if (!value || typeof value !== "object") return { ok: false, results: [], error: "Import ไม่สำเร็จ" }

  const payload = value as { ok?: unknown; results?: unknown; skipped?: unknown; error?: unknown }
  return {
    ok: payload.ok === true,
    results: Array.isArray(payload.results) ? (payload.results as ImportResult[]) : [],
    skipped: Array.isArray(payload.skipped)
      ? payload.skipped.map((item) => {
          if (typeof item === "string") return { filename: item, reason: "unsupported_type" }
          if (item && typeof item === "object" && "filename" in item) {
            const skipped = item as { filename?: unknown; reason?: unknown }
            return {
              filename: String(skipped.filename ?? ""),
              reason: typeof skipped.reason === "string" ? skipped.reason : "unsupported_type",
            }
          }
          return { filename: String(item), reason: "unsupported_type" }
        })
      : [],
    error: typeof payload.error === "string" ? payload.error : undefined,
  }
}

function resultBadge(result: ImportResult) {
  if (result.status === "skipped_existing" || result.stdout?.startsWith("[skip]")) {
    return {
      label: "ข้าม: มีอยู่แล้ว",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    }
  }
  if (result.ok) {
    return {
      label: "สำเร็จ",
      className: "border-green-200 bg-green-100 text-green-800",
    }
  }
  return {
    label: "ไม่สำเร็จ",
    className: "border-red-200 bg-red-100 text-red-800",
  }
}

function isSkippedExisting(result: ImportResult) {
  return result.status === "skipped_existing" || result.stdout?.startsWith("[skip]")
}

function getSummary(results: ImportResult[]) {
  return {
    imported: results.filter((result) => result.ok && !isSkippedExisting(result)).length,
    skippedExisting: results.filter(isSkippedExisting).length,
    failed: results.filter((result) => !result.ok).length,
    total: results.length,
  }
}

function skippedLabel(reason: string) {
  if (reason === "unsupported_type") return "ข้าม: ไม่ใช่ xlsx"
  return "ข้าม"
}

export default function ImportDocumentForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<ImportResponse | null>(null)
  const summary = response ? getSummary(response.results) : null

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResponse(null)

    const body = new FormData(event.currentTarget)
    const selectedFile = body.get("file")
    const fallbackFile = file ?? inputRef.current?.files?.[0] ?? null
    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      if (!fallbackFile) {
        setError("กรุณาเลือกไฟล์ก่อน")
        return
      }
      body.set("file", fallbackFile)
    }

    setLoading(true)
    try {
      const res = await fetch("/api/import/documents", {
        method: "POST",
        body,
      })
      const payload = normalizeImportResponse(await res.json().catch(() => null))
      setResponse(payload)
      if (!res.ok) setError(payload.error ?? "Import ไม่สำเร็จ")
    } catch {
      setError("Import ไม่สำเร็จ กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">เลือกไฟล์ .xlsx หรือ .zip</span>
          <Input
            ref={inputRef}
            name="file"
            type="file"
            accept=".xlsx,.zip,application/zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-11 bg-white"
          />
        </label>
        <Button type="submit" disabled={loading} className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? "กำลัง import..." : "เริ่ม import"}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {response ? (
        <div className="rounded-lg border border-[var(--crm-line)] bg-white">
          <div className="border-b border-[var(--crm-line)] px-4 py-3">
            <h2 className="font-semibold text-[var(--crm-ink)]">ผลการ import</h2>
            {summary ? (
              <p className="mt-1 text-sm text-[var(--crm-muted)]">
                นำเข้าใหม่ {summary.imported.toLocaleString("th-TH")} / {summary.total.toLocaleString("th-TH")} ไฟล์
                {summary.skippedExisting ? ` · มีอยู่แล้ว ${summary.skippedExisting.toLocaleString("th-TH")} ไฟล์` : ""}
                {summary.failed ? ` · ไม่สำเร็จ ${summary.failed.toLocaleString("th-TH")} ไฟล์` : ""}
                {response.skipped?.length ? ` · ไม่ใช่ xlsx ${response.skipped.length.toLocaleString("th-TH")} ไฟล์` : ""}
              </p>
            ) : null}
          </div>
          <div className="border-b border-[var(--crm-line)] bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                ไฟล์ที่ข้าม ({(response.skipped?.length ?? 0).toLocaleString("th-TH")})
              </p>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                ไม่ใช่ไฟล์ Excel
              </Badge>
            </div>
            {response.skipped?.length ? (
              <ul className="mt-2 grid gap-1 text-xs text-gray-600">
                {response.skipped.slice(0, 100).map((skipped) => (
                  <li key={skipped.filename} className="rounded-md bg-white px-2 py-1">
                    <span className="font-medium text-gray-800">{skippedLabel(skipped.reason)}</span> · {skipped.filename}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-gray-500">ไม่มีไฟล์ที่ข้าม</p>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {response.results.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--crm-muted)]">ไม่พบไฟล์ .xlsx สำหรับ import</p>
            ) : (
              response.results.map((result) => (
                <div key={result.filename} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">{result.filename}</p>
                    <Badge variant="outline" className={resultBadge(result).className}>
                      {resultBadge(result).label}
                    </Badge>
                  </div>
                  {result.stdout ? <p className="mt-1 text-xs text-gray-500">{result.stdout}</p> : null}
                  {result.stderr ? <p className="mt-1 whitespace-pre-wrap text-xs text-red-600">{result.stderr}</p> : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
