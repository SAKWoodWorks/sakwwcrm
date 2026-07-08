import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Module-level in-memory dedupe guard: driveFileId -> last-spawned timestamp.
const inFlight = new Map<string, number>()
const DEDUPE_WINDOW_MS = 60_000

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.alloc(bufA.length)
  Buffer.from(b).copy(bufB)
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Validate secret token — must run before any early-return so every path is authenticated
  const token = request.headers.get('x-goog-channel-token')
  const secret = process.env.GDRIVE_WEBHOOK_TOKEN
  if (!secret || !token || !timingSafeEqual(token, secret)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const state = request.headers.get('x-goog-resource-state')

  // Initial sync handshake
  if (state === 'sync') {
    return new NextResponse(null, { status: 200 })
  }

  if (state !== 'update') {
    return new NextResponse(null, { status: 200 })
  }

  const resourceUri = request.headers.get('x-goog-resource-uri') ?? ''
  const resourceIdHeader = request.headers.get('x-goog-resource-id') ?? ''

  // resourceUri looks like https://www.googleapis.com/drive/v3/files/<fileId>?...
  // x-goog-resource-id is an opaque watch-channel id, NOT the Drive file id — only used as a fallback.
  const match = resourceUri.match(/\/files\/([^/?]+)/)
  const driveFileId = match ? match[1] : resourceIdHeader

  if (!driveFileId) {
    return new NextResponse(null, { status: 200 })
  }

  // Skip if we already spawned an extraction for this file within the dedupe window
  const now = Date.now()
  for (const [id, ts] of inFlight) {
    if (now - ts > DEDUPE_WINDOW_MS) inFlight.delete(id)
  }
  const lastSpawn = inFlight.get(driveFileId)
  if (lastSpawn && now - lastSpawn < DEDUPE_WINDOW_MS) {
    return new NextResponse(null, { status: 200 })
  }
  inFlight.set(driveFileId, now)

  const pythonExe = process.env.PYTHON_VENV_PATH ?? 'python'
  const extractDir = process.env.EXTRACTION_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'extraction')
  const scriptPath = path.join(/* turbopackIgnore: true */ extractDir, 'extract_file.py')

  // Spawn async — webhook must return fast
  const child = spawn(pythonExe, [
    scriptPath,
    '--file-id', driveFileId,  // Python fetches the real filename from Drive
  ], {
    cwd: extractDir,
    detached: true,
    stdio: 'ignore',
  })
  child.on('error', (err) => console.error('gdrive extract spawn failed', err))
  child.unref()

  return new NextResponse(null, { status: 200 })
}
