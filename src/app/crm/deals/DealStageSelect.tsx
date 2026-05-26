"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/deals"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  dealId: number
  currentStage: string
}

export default function DealStageSelect({ dealId, currentStage }: Props) {
  const router = useRouter()
  const [stage, setStage] = useState(currentStage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStage(nextStage: string) {
    setStage(nextStage)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setStage(currentStage)
        setError((json as { error?: string }).error ?? "อัปเดตสถานะไม่สำเร็จ")
        return
      }
      router.refresh()
    } catch {
      setStage(currentStage)
      setError("อัปเดตสถานะไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Select
        value={stage}
        disabled={loading}
        onValueChange={updateStage}
      >
        <SelectTrigger className="h-10 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEAL_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {DEAL_STAGE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
