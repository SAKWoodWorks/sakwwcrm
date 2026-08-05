import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Dedupe guard: key -> last-spawned timestamp
const inFlight = new Map<string, number>()
const DEDUPE_WINDOW_MS = 60_000

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.alloc(bufA.length)
  Buffer.from(b).copy(bufB)
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length
}

function dedupe(key: string): boolean {
  const now = Date.now()
  for (const [k, ts] of inFlight) {
    if (now - ts > DEDUPE_WINDOW_MS) inFlight.delete(k)
  }
  if ((inFlight.get(key) ?? 0) + DEDUPE_WINDOW_MS > now) return true
  inFlight.set(key, now)
  return false
}

function spawnDetached(exe: string, args: string[], cwd: string, label: string) {
  const child = spawn(exe, args, { cwd, detached: true, stdio: 'ignore' })
  child.on('error', (err) => console.error(`${label} spawn failed:`, err))
  child.unref()
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.headers.get('x-goog-channel-token')
  const secret = process.env.GDRIVE_WEBHOOK_TOKEN
  if (!secret || !token || !timingSafeEqual(token, secret)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const state = request.headers.get('x-goog-resource-state')
  if (state === 'sync') {
    return new NextResponse(null, { status: 200 })
  }
  if (state !== 'update') {
    return new NextResponse(null, { status: 200 })
  }

  const pythonExe = process.env.PYTHON_VENV_PATH ?? 'python'
  const extractDir = process.env.EXTRACTION_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'extraction')
  const resourceUri = request.headers.get('x-goog-resource-uri') ?? ''

  // changes.watch notification — resource URI is .../drive/v3/changes
  if (resourceUri.includes('/changes')) {
    if (dedupe('__changes__')) {
      return new NextResponse(null, { status: 200 })
    }
    spawnDetached(
      pythonExe,
      [path.join(/* turbopackIgnore: true */ extractDir, 'gdrive_changes.py')],
      extractDir,
      'gdrive_changes',
    )
    return new NextResponse(null, { status: 200 })
  }

  // files.watch notification — resource URI is .../drive/v3/files/<fileId>
  const match = resourceUri.match(/\/files\/([^/?]+)/)
  const resourceIdHeader = request.headers.get('x-goog-resource-id') ?? ''
  const driveFileId = match ? match[1] : resourceIdHeader

  if (!driveFileId) {
    return new NextResponse(null, { status: 200 })
  }

  if (dedupe(driveFileId)) {
    return new NextResponse(null, { status: 200 })
  }

  spawnDetached(
    pythonExe,
    [path.join(/* turbopackIgnore: true */ extractDir, 'extract_file.py'), '--file-id', driveFileId],
    extractDir,
    'gdrive_extract',
  )

  return new NextResponse(null, { status: 200 })
}
