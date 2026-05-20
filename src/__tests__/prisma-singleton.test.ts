import { describe, it, expect, vi } from "vitest"

vi.mock("@prisma/client", () => {
  const PrismaClient = vi.fn(function () {
    return {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    }
  })
  return { PrismaClient }
})

describe("prisma singleton", () => {
  it("exports a PrismaClient instance", async () => {
    const { prisma } = await import("@/lib/prisma")
    expect(prisma).toBeDefined()
    expect(typeof prisma).toBe("object")
  })
})
