import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const createMock = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: createMock } }
  }),
}))

import { draftFollowUpMessage } from "@/lib/ai"

const baseInput = {
  customerName: "บริษัท เคไอที จำกัด",
  salespersonName: "Pickachu",
  daysSince: 137,
  orderCount: 12,
  lastTotal: 27960,
}

describe("draftFollowUpMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns null without constructing a request when ANTHROPIC_API_KEY is unset", async () => {
    const original = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    try {
      const result = await draftFollowUpMessage(baseInput)
      expect(result).toBeNull()
      expect(createMock).not.toHaveBeenCalled()
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original
    }
  })

  it("returns the drafted text when the API call succeeds", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "  สวัสดีค่ะคุณลูกค้า ไม่ได้ติดต่อกันนานเลยนะคะ  " }],
    })

    const result = await draftFollowUpMessage(baseInput)

    expect(result).toBe("สวัสดีค่ะคุณลูกค้า ไม่ได้ติดต่อกันนานเลยนะคะ")
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-fable-5",
        max_tokens: 300,
      })
    )
  })

  it("returns null when the API call throws", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
    createMock.mockRejectedValue(new Error("network error"))

    const result = await draftFollowUpMessage(baseInput)

    expect(result).toBeNull()
  })

  it("returns null when the response text is empty", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "   " }],
    })

    const result = await draftFollowUpMessage(baseInput)

    expect(result).toBeNull()
  })
})
