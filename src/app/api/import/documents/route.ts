import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
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

function runImport(scriptPath: string, uploadPath: string, cwd: string) {
  const pythonExe = process.env.PYTHON_VENV_PATH ?? "python"

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      pythonExe,
      [scriptPath, "--path", uploadPath],
      {
        cwd,
        timeout: 10 * 60 * 1000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }))
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
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

    const extractDir = process.env.EXTRACTION_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "extraction")
    const scriptPath = path.join(/* turbopackIgnore: true */ extractDir, "import_upload.py")
    const { stdout } = await runImport(scriptPath, uploadPath, extractDir)
    return NextResponse.json(parseImportOutput(stdout))
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? String(error.stdout) : ""
    const stderr = typeof error === "object" && error && "stderr" in error ? String(error.stderr) : ""
    const payload = stdout ? parseImportOutput(stdout) : { ok: false, results: [], error: stderr || "Import failed" }
    return NextResponse.json(payload, { status: 500 })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
