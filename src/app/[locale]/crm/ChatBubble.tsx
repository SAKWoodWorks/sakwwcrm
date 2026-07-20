"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircleIcon, XIcon, SendIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Message = { role: "user" | "model"; text: string }

export default function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: "user", text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const history = next.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }))

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      })

      const json = await res.json().catch(() => ({}))
      const reply = (json as { reply?: string; error?: string }).reply
        ?? (json as { error?: string }).error
        ?? "Something went wrong."

      setMessages((prev) => [...prev, { role: "model", text: reply }])
    } catch {
      setMessages((prev) => [...prev, { role: "model", text: "Connection error. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[480px] w-80 flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-xl bg-[var(--crm-brand)] px-4 py-3">
            <span className="font-semibold text-white">CRM Assistant</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-white/80 hover:text-white"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-400">
                Ask me about customers, sales, or deals.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[var(--crm-brand)] text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500">
                  <span className="animate-pulse">•••</span>
                </div>
            </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 border-t border-gray-100 p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type a question..."
              disabled={loading}
              className="h-9 flex-1 bg-white text-sm"
            />
            <Button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="h-9 bg-[var(--crm-brand)] px-3 hover:bg-[var(--crm-brand-dark)]"
            >
              <SendIcon className="size-4 text-white" />
            </Button>
          </div>
        </div>
      )}

      {/* Bubble trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open CRM assistant"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[var(--crm-brand)] shadow-lg hover:bg-[var(--crm-brand-dark)]"
      >
        {open ? (
          <XIcon className="size-6 text-white" />
        ) : (
          <MessageCircleIcon className="size-6 text-white" />
        )}
      </button>
    </>
  )
}
