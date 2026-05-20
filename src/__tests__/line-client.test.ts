import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import crypto from "crypto"

vi.mock("@/lib/line", async (importOriginal) => {
  return await importOriginal()
})

describe("verifySignature", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "test-secret")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true for valid HMAC-SHA256 signature", async () => {
    const { verifySignature } = await import("@/lib/line")
    const body = "hello"
    const expected = crypto
      .createHmac("sha256", "test-secret")
      .update(body)
      .digest("base64")
    expect(verifySignature(body, expected)).toBe(true)
  })

  it("returns false for wrong signature", async () => {
    const { verifySignature } = await import("@/lib/line")
    expect(verifySignature("hello", "bad-signature")).toBe(false)
  })
})

describe("pushMessage", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token")
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("calls LINE push API with correct payload", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })
    const { pushMessage } = await import("@/lib/line")
    await pushMessage("U123", "test message")

    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          to: "U123",
          messages: [{ type: "text", text: "test message" }],
        }),
      })
    )
  })

  it("throws on non-ok response", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    })
    const { pushMessage } = await import("@/lib/line")
    await expect(pushMessage("U123", "test")).rejects.toThrow("LINE push failed: 429")
  })
})

describe("replyMessage", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token")
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("calls LINE reply API with correct payload", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })
    const { replyMessage } = await import("@/lib/line")
    await replyMessage("reply-token-xyz", "hello")

    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          replyToken: "reply-token-xyz",
          messages: [{ type: "text", text: "hello" }],
        }),
      })
    )
  })

  it("throws on non-ok response", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "invalid reply token",
    })
    const { replyMessage } = await import("@/lib/line")
    await expect(replyMessage("expired-token", "hi")).rejects.toThrow("LINE reply failed: 400")
  })
})
