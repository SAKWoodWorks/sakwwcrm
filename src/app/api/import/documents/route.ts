import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { execFile } from "child_process"
import { randomUUID } from "crypto"
import { mkdir, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const allowedExtensions = new Set([".xlsx", ".zip"])

type UploadedFile = {
  name: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      typeof value.name === "string" &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function"
  )
}

function safeFilename(name: string) {
  const ext = path.extname(name).toLowerCase()
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9ก-๙._-]+/g, "-").slice(0, 80)
  return `${base || "upload"}${ext}`
}

function runImport(jobId: number, scriptPath: string, uploadPath: string, cwd: string, tempDir: string) {
  const pythonExe = process.env.PYTHON_VENV_PATH ?? "python"

  void prisma.importJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  }).catch(() => null)

  execFile(
    pythonExe,
    [scriptPath, "--path", uploadPath],
    {
      cwd,
      timeout: 10 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    },
    (error, stdout, stderr) => {
      const payload = stdout ? parseImportOutput(stdout) : { ok: false, results: [], error: stderr || "Import failed" }
      const status = error ? "failed" : "completed"
      const errorMessage = error ? ((payload.error ?? stderr) || "Import failed") : null

      void prisma.importJob.update({
        where: { id: jobId },
        data: {
          status,
          result: payload,
          error: errorMessage,
          finishedAt: new Date(),
        },
      }).finally(() => {
        void rm(tempDir, { recursive: true, force: true })
      })
    }
  )
}

function parseImportOutput(stdout: string) {
  try {
    return JSON.parse(stdout)
  } catch {
    return {
      ok: false,
      results: [],
      error: "Import did not return valid JSON",
      stdout,
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!isUploadedFile(file)) return NextResponse.json({ error: "file is required" }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase()
  if (!allowedExtensions.has(ext)) return NextResponse.json({ error: "Only .xlsx and .zip files are supported" }, { status: 400 })

  const tempDir = path.join(os.tmpdir(), `crm-import-${randomUUID()}`)
  await mkdir(tempDir, { recursive: true })

  const uploadPath = path.join(tempDir, safeFilename(file.name))
  try {
    await writeFile(uploadPath, Buffer.from(await file.arrayBuffer()))
    const job = await prisma.importJob.create({
      data: {
        filename: file.name,
        status: "queued",
        actorEmail: session?.user?.email ?? null,
      },
      select: { id: true, filename: true, status: true, createdAt: true },
    })

    const extractDir = process.env.EXTRACTION_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "extraction")
    const scriptPath = path.join(/* turbopackIgnore: true */ extractDir, "import_upload.py")
    runImport(job.id, scriptPath, uploadPath, extractDir, tempDir)
    return NextResponse.json({ ok: true, job }, { status: 202 })
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Import job failed" }, { status: 500 })
  }
}
