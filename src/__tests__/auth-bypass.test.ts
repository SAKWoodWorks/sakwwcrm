import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/auth", () => ({
  auth: vi.fn((handler) => handler),
}))

describe("auth bypass", () => {
  const originalDisableAuth = process.env.DISABLE_AUTH
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (originalDisableAuth === undefined) {
      delete process.env.DISABLE_AUTH
    } else {
      process.env.DISABLE_AUTH = originalDisableAuth
    }
    process.env.NODE_ENV = originalNodeEnv
  })

  it("lets CRM pages through when DISABLE_AUTH is true", async () => {
    process.env.DISABLE_AUTH = "true"
    const middleware = (await import("@/middleware")).default
    const req = new NextRequest("http://localhost/crm/deals")

    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })

  it("does not bypass auth in production even when DISABLE_AUTH is true", async () => {
    process.env.DISABLE_AUTH = "true"
    process.env.NODE_ENV = "production"
    const middleware = (await import("@/middleware")).default
    const req = new NextRequest("http://localhost/crm/deals")

    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/login")
  })
})
