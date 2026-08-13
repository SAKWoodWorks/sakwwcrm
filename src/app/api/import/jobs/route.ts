import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"


export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [jobs, latestGoogleDriveImport] = await Promise.all([
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        filename: true,
        status: true,
        result: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    }),
    prisma.syncLog.findFirst({
      where: {
        gdriveFileId: { not: null },
        NOT: {
          gdriveFileId: { startsWith: "local::" },
        },
      },
      orderBy: { processedAt: "desc" },
      select: {
        id: true,
        gdriveFileId: true,
        filename: true,
        status: true,
        errorMsg: true,
        processedAt: true,
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    jobs,
    latestGoogleDriveImport: latestGoogleDriveImport
      ? {
          id: latestGoogleDriveImport.id,
          filename: latestGoogleDriveImport.filename,
          status: latestGoogleDriveImport.status,
          errorMsg: latestGoogleDriveImport.errorMsg,
          processedAt: latestGoogleDriveImport.processedAt,
          url: latestGoogleDriveImport.gdriveFileId
            ? `https://drive.google.com/file/d/${encodeURIComponent(latestGoogleDriveImport.gdriveFileId)}/view`
            : null,
        }
      : null,
  })
}
