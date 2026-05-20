import crypto from "crypto"

const LINE_API = "https://api.line.me/v2/bot/message"

function authHeader(): Record<string, string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set")
  return { Authorization: `Bearer ${token}` }
}

export function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  const bufDigest = Buffer.from(digest)
  const bufSig = Buffer.from(signature)
  if (bufDigest.length !== bufSig.length) return false
  return crypto.timingSafeEqual(bufDigest, bufSig)
}

export async function pushMessage(userId: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/push`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE push failed: ${res.status} ${body}`)
  }
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/reply`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE reply failed: ${res.status} ${body}`)
  }
}
