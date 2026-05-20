import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const state = request.headers.get('x-goog-resource-state')

  // Initial sync handshake
  if (state === 'sync') {
    return new NextResponse(null, { status: 200 })
  }

  // Validate secret token
  const token = request.headers.get('x-goog-channel-token')
  if (token !== process.env.GDRIVE_WEBHOOK_TOKEN) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (state !== 'update') {
    return new NextResponse(null, { status: 200 })
  }

  const fileId = request.headers.get('x-goog-resource-id') ?? ''
  const resourceUri = request.headers.get('x-goog-resource-uri') ?? ''

  if (!fileId) {
    return new NextResponse(null, { status: 200 })
  }

  const pythonExe = process.env.PYTHON_VENV_PATH ?? 'python'
  const extractDir = process.env.EXTRACTION_DIR ?? path.join(process.cwd(), 'extraction')
  const scriptPath = path.join(extractDir, 'extract_file.py')

  // Spawn async — webhook must return fast
  const child = spawn(pythonExe, [
    scriptPath,
    '--file-id', fileId,
    '--filename', resourceUri,  // Python fetches real filename from Drive if needed
  ], {
    cwd: extractDir,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  return new NextResponse(null, { status: 200 })
}
