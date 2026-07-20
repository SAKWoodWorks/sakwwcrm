import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const { mockSendMessage, mockStartChat } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockStartChat: vi.fn(),
}))

vi.mock("@/lib/gemini", () => ({
  createGeminiModel: vi.fn().mockReturnValue({
    startChat: mockStartChat,
  }),
  executeTool: vi.fn().mockResolvedValue({ total_customers: 42 }),
  toolDeclarations: [],
}))

vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: {} }) }))
vi.mock("@/lib/auth-bypass", () => ({ isAuthBypassed: vi.fn().mockReturnValue(false) }))

import { POST } from "@/app/api/ai/chat/route"
import { createGeminiModel } from "@/lib/gemini"

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartChat.mockReturnValue({ sendMessage: mockSendMessage })
  })

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it("returns 400 when message is empty string", async () => {
    const res = await POST(makeRequest({ message: "  " }))
    expect(res.status).toBe(400)
  })

  it("returns 503 when GEMINI_API_KEY is not set", async () => {
    vi.mocked(createGeminiModel).mockReturnValueOnce(null)
    const res = await POST(makeRequest({ message: "hello" }))
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error).toBe("AI not configured")
  })

  it("returns reply text when Gemini responds with plain text", async () => {
    mockSendMessage.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: "มี 42 ลูกค้า" }] } }],
        text: () => "มี 42 ลูกค้า",
      },
    })

    const res = await POST(makeRequest({ message: "มีลูกค้ากี่คน" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reply).toBe("มี 42 ลูกค้า")
  })

  it("returns 500 when Gemini throws", async () => {
    mockSendMessage.mockRejectedValue(new Error("quota exceeded"))

    const res = await POST(makeRequest({ message: "สวัสดี" }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe("AI unavailable")
  })

  it("calls executeTool and returns final reply when Gemini responds with a function call", async () => {
    const { executeTool } = await import("@/lib/gemini")
    vi.mocked(executeTool).mockResolvedValueOnce({ total_customers: 99 })

    // First sendMessage returns a function call
    mockSendMessage
      .mockResolvedValueOnce({
        response: {
          candidates: [{
            content: {
              parts: [{ functionCall: { name: "get_dashboard_stats", args: {} } }],
            },
          }],
          text: () => "",
        },
      })
      // Second sendMessage (after tool result) returns plain text
      .mockResolvedValueOnce({
        response: {
          candidates: [{ content: { parts: [{ text: "มี 99 ลูกค้า" }] } }],
          text: () => "มี 99 ลูกค้า",
        },
      })

    const res = await POST(makeRequest({ message: "มีลูกค้ากี่คน" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.reply).toBe("มี 99 ลูกค้า")
    expect(vi.mocked(executeTool)).toHaveBeenCalledWith("get_dashboard_stats", {})
  })
})
