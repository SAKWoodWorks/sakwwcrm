"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

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

type ImportPayload = {
  ok: boolean
  results: ImportResult[]
  skipped?: SkippedImportFile[]
  error?: string
}

type ImportJob = {
  id: number
  filename: string
  status: "queued" | "running" | "completed" | "failed" | string
  result?: ImportPayload | null
  error?: string | null
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

type CreateJobResponse = {
  ok: boolean
  job?: ImportJob
  error?: string
}

function normalizeImportPayload(value: unknown): ImportPayload {
  if (!value || typeof value !== "object") return { ok: false, results: [], error: "Import failed" }

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

function normalizeJob(value: unknown): ImportJob | null {
  if (!value || typeof value !== "object") return null
  const job = value as Partial<ImportJob>
  const id = typeof job.id === "number" && Number.isInteger(job.id) ? job.id : null
  const filename = typeof job.filename === "string" ? job.filename : null
  const status = typeof job.status === "string" ? job.status : null
  if (id == null || !filename || !status) return null

  return {
    id,
    filename,
    status,
    result: job.result ? normalizeImportPayload(job.result) : null,
    error: typeof job.error === "string" ? job.error : null,
    createdAt: String(job.createdAt ?? new Date().toISOString()),
    startedAt: job.startedAt ? String(job.startedAt) : null,
    finishedAt: job.finishedAt ? String(job.finishedAt) : null,
  }
}

function resultBadge(result: ImportResult, t: ReturnType<typeof useTranslations>) {
  if (result.status === "skipped_existing" || result.stdout?.startsWith("[skip]")) {
    return {
      label: t("resultBadges.skippedExisting"),
      className: "border-slate-200 bg-slate-100 text-slate-700",
    }
  }
  if (result.ok) {
    return {
      label: t("resultBadges.success"),
      className: "border-green-200 bg-green-100 text-green-800",
    }
  }
  return {
    label: t("resultBadges.failed"),
    className: "border-red-200 bg-red-100 text-red-800",
  }
}

function jobBadge(status: string, t: ReturnType<typeof useTranslations>) {
  if (status === "completed") return { label: t("jobBadges.completed"), className: "border-green-200 bg-green-100 text-green-800" }
  if (status === "failed") return { label: t("jobBadges.failed"), className: "border-red-200 bg-red-100 text-red-800" }
  if (status === "running") return { label: t("jobBadges.running"), className: "border-blue-200 bg-blue-100 text-blue-800" }
  return { label: t("jobBadges.queued"), className: "border-slate-200 bg-slate-100 text-slate-700" }
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

function skippedLabel(reason: string, t: ReturnType<typeof useTranslations>) {
  if (reason === "unsupported_type") return t("skippedUnsupported")
  return t("skipped")
}

function isActiveJob(job: ImportJob | null) {
  return job?.status === "queued" || job?.status === "running"
}

export default function ImportDocumentForm() {
  const t = useTranslations("Import")
  const locale = toLocaleTag(useLocale())
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null)
  const [jobs, setJobs] = useState<ImportJob[]>([])

  async function loadJobs() {
    try {
      const res = await fetch("/api/import/jobs", { cache: "no-store" })
      if (!res.ok) return
      const payload = (await res.json().catch(() => null)) as { jobs?: unknown[] } | null
      setJobs(Array.isArray(payload?.jobs) ? payload.jobs.map(normalizeJob).filter((job): job is ImportJob => Boolean(job)) : [])
    } catch {
      setJobs([])
    }
  }

  async function loadJob(jobId: number) {
    try {
      const res = await fetch(`/api/import/jobs/${jobId}`, { cache: "no-store" })
      if (!res.ok) return null
      const payload = (await res.json().catch(() => null)) as { job?: unknown } | null
      return normalizeJob(payload?.job)
    } catch {
      return null
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJobs()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "queued" && activeJob.status !== "running")) return
    const jobId = activeJob.id

    const timer = window.setInterval(() => {
      void loadJob(jobId).then((job) => {
        if (!job) return
        setActiveJob(job)
        if (!isActiveJob(job)) void loadJobs()
      })
    }, 2500)

    return () => window.clearInterval(timer)
  }, [activeJob])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const body = new FormData(event.currentTarget)
    const selectedFile = body.get("file")
    const fallbackFile = file ?? inputRef.current?.files?.[0] ?? null
    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      if (!fallbackFile) {
        setError(t("selectFileError"))
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
      const payload = (await res.json().catch(() => null)) as CreateJobResponse | null
      const job = normalizeJob(payload?.job)
      if (!res.ok || !job) throw new Error(payload?.error ?? t("importFailed"))

      setActiveJob(job)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tryAgain"))
    } finally {
      setLoading(false)
    }
  }

  const payload = activeJob?.result ? normalizeImportPayload(activeJob.result) : null
  const summary = payload ? getSummary(payload.results) : null

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--crm-muted)]">{t("selectFile")}</span>
          <Input
            ref={inputRef}
            name="file"
            type="file"
            accept=".xlsx,.zip,application/zip"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-11 bg-white"
          />
        </label>
        <Button type="submit" disabled={loading || isActiveJob(activeJob)} className="h-11 bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? t("creating") : isActiveJob(activeJob) ? t("importing") : t("start")}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeJob ? (
        <div className="rounded-lg border border-[var(--crm-line)] bg-white">
          <div className="border-b border-[var(--crm-line)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-[var(--crm-ink)]">{t("resultTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("jobLine", { id: activeJob.id, filename: activeJob.filename })}</p>
              </div>
              <Badge variant="outline" className={jobBadge(activeJob.status, t).className}>
                {jobBadge(activeJob.status, t).label}
              </Badge>
            </div>
            {summary ? (
              <p className="mt-2 text-sm text-[var(--crm-muted)]">
                {t("summary.new", { imported: summary.imported.toLocaleString(locale), total: summary.total.toLocaleString(locale) })}
                {summary.skippedExisting ? ` · ${t("summary.existing", { count: summary.skippedExisting.toLocaleString(locale) })}` : ""}
                {summary.failed ? ` · ${t("summary.failed", { count: summary.failed.toLocaleString(locale) })}` : ""}
                {payload?.skipped?.length ? ` · ${t("summary.unsupported", { count: payload.skipped.length.toLocaleString(locale) })}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--crm-muted)]">{t("summary.running")}</p>
            )}
          </div>

          {payload ? <ImportResultPanel payload={payload} locale={locale} /> : null}
          {activeJob.error ? <p className="px-4 py-3 text-sm text-red-600">{activeJob.error}</p> : null}
        </div>
      ) : null}

      <ImportHistory jobs={jobs} onSelect={setActiveJob} locale={locale} />
    </div>
  )
}

function ImportResultPanel({ payload, locale }: { payload: ImportPayload; locale: string }) {
  const t = useTranslations("Import")

  return (
    <>
      <div className="border-b border-[var(--crm-line)] bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">
            {t("skippedTitle", { count: (payload.skipped?.length ?? 0).toLocaleString(locale) })}
          </p>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {t("notExcel")}
          </Badge>
        </div>
        {payload.skipped?.length ? (
          <ul className="mt-2 grid gap-1 text-xs text-gray-600">
            {payload.skipped.slice(0, 100).map((skipped) => (
              <li key={skipped.filename} className="rounded-md bg-white px-2 py-1">
                <span className="font-medium text-gray-800">{skippedLabel(skipped.reason, t)}</span> · {skipped.filename}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-gray-500">{t("noSkipped")}</p>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {payload.results.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--crm-muted)]">{t("noXlsx")}</p>
        ) : (
          payload.results.map((result) => (
            <div key={result.filename} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">{result.filename}</p>
                <Badge variant="outline" className={resultBadge(result, t).className}>
                  {resultBadge(result, t).label}
                </Badge>
              </div>
              {result.stdout ? <p className="mt-1 text-xs text-gray-500">{result.stdout}</p> : null}
              {result.stderr ? <p className="mt-1 whitespace-pre-wrap text-xs text-red-600">{result.stderr}</p> : null}
            </div>
          ))
        )}
      </div>
    </>
  )
}

function ImportHistory({ jobs, onSelect, locale }: { jobs: ImportJob[]; onSelect: (job: ImportJob) => void; locale: string }) {
  const t = useTranslations("Import")

  return (
    <div className="rounded-lg border border-[var(--crm-line)] bg-white">
      <div className="border-b border-[var(--crm-line)] px-4 py-3">
        <h2 className="font-semibold text-[var(--crm-ink)]">{t("historyTitle")}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {jobs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--crm-muted)]">{t("noHistory")}</p>
        ) : jobs.map((job) => {
          const badge = jobBadge(job.status, t)
          const summary = job.result ? getSummary(normalizeImportPayload(job.result).results) : null
          return (
            <button
              type="button"
              key={job.id}
              onClick={() => onSelect(job)}
              className="block w-full px-4 py-3 text-left transition hover:bg-gray-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">#{job.id} · {job.filename}</p>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">
                    {new Date(job.createdAt).toLocaleString(locale)}
                    {summary ? ` · ${t("historySummary", {
                      imported: summary.imported.toLocaleString(locale),
                      skipped: summary.skippedExisting.toLocaleString(locale),
                      failed: summary.failed.toLocaleString(locale),
                    })}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
