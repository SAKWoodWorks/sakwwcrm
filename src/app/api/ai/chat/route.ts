import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { isAuthBypassed } from "@/lib/auth-bypass"
import { createGeminiModel, executeTool } from "@/lib/gemini"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session && !isAuthBypassed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  const history = Array.isArray(body?.history) ? body.history : []

  const model = createGeminiModel()
  if (!model) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 })
  }

  try {
    const chat = model.startChat({ history })
    const result = await chat.sendMessage(message)
    const response = result.response

    const functionCall = response.functionCalls()?.[0]

    if (functionCall?.name) {
      const { name } = functionCall
      const args = functionCall.args as Record<string, unknown> | undefined
      let toolResult: unknown
      try {
        toolResult = await executeTool(name, args ?? {})
      } catch {
        toolResult = { error: "query failed" }
      }

      const result2 = await chat.sendMessage([
        { functionResponse: { name, response: { result: toolResult } } },
      ])
      return NextResponse.json({ reply: result2.response.text() })
    }

    return NextResponse.json({ reply: response.text() })
  } catch (err) {
    console.error("AI chat error:", err)
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 })
  }
}
