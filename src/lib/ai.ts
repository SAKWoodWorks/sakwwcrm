import Anthropic from "@anthropic-ai/sdk"

const SYSTEM_PROMPT = `You draft short, warm, polite Thai LINE follow-up messages on behalf of a salesperson at a timber and wood-products company (บริษัทขายไม้), sent to a customer who has not purchased in a while. Write in Thai. Keep the message under 350 characters. Mention roughly how long it has been since the customer's last purchase and refer naturally to their purchase history, without sounding like a report. The tone should be friendly and warm, never pushy or sales-heavy. Use at most one or two emojis, or none at all — do not overuse them. Do not include any placeholders or bracketed text such as [name] or {value}; write a complete, ready-to-send message using only the information given. Output only the message text itself, with no preamble, quotation marks, or explanation.`

export interface FollowUpInput {
  customerName: string
  salespersonName: string
  daysSince: number
  orderCount: number
  lastTotal: number | null
}

export async function draftFollowUpMessage(input: FollowUpInput): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic()
    const userPrompt = [
      `ชื่อลูกค้า: ${input.customerName}`,
      `พนักงานขาย: ${input.salespersonName}`,
      `ไม่ได้ซื้อมาแล้ว: ${input.daysSince} วัน`,
      `จำนวนครั้งที่เคยซื้อ: ${input.orderCount} ครั้ง`,
      `ยอดซื้อครั้งล่าสุด: ${input.lastTotal != null ? `${input.lastTotal.toLocaleString("th-TH")} บาท` : "ไม่ทราบ"}`,
    ].join("\n")

    const response = await client.messages.create({
      model: "claude-fable-5",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const block = response.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") return null

    const text = block.text.trim()
    return text.length > 0 ? text : null
  } catch (err) {
    console.error("draftFollowUpMessage failed:", err)
    return null
  }
}
