import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/auth-bypass", () => ({
  isAuthBypassed: vi.fn(() => false),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    importJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    syncLog: {
      findFirst: vi.fn(),
    },
  },
}))

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { GET as GET_JOBS } from "@/app/api/import/jobs/route"
import { GET as GET_JOB } from "@/app/api/import/jobs/[id]/route"

const mockSession = { user: { email: "admin@sakww.com" } } as Awaited<ReturnType<typeof auth>>

describe("import job API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists recent import jobs", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.importJob.findMany).mockResolvedValue([
      {
        id: 1,
        filename: "docs.zip",
        status: "completed",
        result: { ok: true, results: [] },
        error: null,
        actorEmail: "admin@sakww.com",
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        startedAt: null,
        finishedAt: null,
      },
    ])
    vi.mocked(prisma.syncLog.findFirst).mockResolvedValue({
      id: 9,
      gdriveFileId: "drive-file-9",
      filename: "TI_B No 009.xlsx",
      status: "success",
      errorMsg: null,
      processedAt: new Date("2026-06-05T09:30:00.000Z"),
    })

    const res = await GET_JOBS()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      jobs: [
        expect.objectContaining({
          id: 1,
          filename: "docs.zip",
          status: "completed",
        }),
      ],
      latestGoogleDriveImport: {
        id: 9,
        filename: "TI_B No 009.xlsx",
        status: "success",
        errorMsg: null,
        processedAt: "2026-06-05T09:30:00.000Z",
        url: "https://drive.google.com/file/d/drive-file-9/view",
      },
    })
    expect(prisma.importJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: "desc" },
      take: 20,
    }))
    expect(prisma.syncLog.findFirst).toHaveBeenCalledWith({
      where: {
        gdriveFileId: {
          not: null,
        },
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
    })
  })

  it("returns one import job by id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.importJob.findUnique).mockResolvedValue({
      id: 2,
      filename: "single.xlsx",
      status: "running",
      result: null,
      error: null,
      actorEmail: null,
      createdAt: new Date("2026-06-04T00:00:00.000Z"),
      startedAt: null,
      finishedAt: null,
    })

    const res = await GET_JOB(new Request("http://localhost"), { params: Promise.resolve({ id: "2" }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      job: expect.objectContaining({
        id: 2,
        filename: "single.xlsx",
        status: "running",
      }),
    })
  })

  it("rejects invalid job id", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession)

    const res = await GET_JOB(new Request("http://localhost"), { params: Promise.resolve({ id: "2abc" }) })

    expect(res.status).toBe(400)
  })
})
