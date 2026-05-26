"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  salespersonId: number
  lineUserId: string | null
}

export default function SalespersonLineManage({ salespersonId, lineUserId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [codeInfo, setCodeInfo] = useState<{ code: string; expiresAt: string } | null>(null)

  async function handleUnlink() {
    if (!confirm("ยืนยันยกเลิกการเชื่อมต่อ LINE?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/salespersons/${salespersonId}/line`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateCode() {
    setLoading(true)
    try {
      const res = await fetch(`/api/salespersons/${salespersonId}/line/code`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setCodeInfo({ code: json.code, expiresAt: json.expiresAt })
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  if (lineUserId) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
          LINE ลงทะเบียนแล้ว
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUnlink}
          disabled={loading}
          className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
        >
          {loading ? "..." : "ยกเลิก LINE"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-500">
          ยังไม่ลงทะเบียน LINE
        </Badge>
        {!codeInfo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerateCode}
            disabled={loading}
            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
          >
            {loading ? "..." : "สร้าง Link Code"}
          </Button>
        )}
      </div>
      {codeInfo && (
        <Card className="border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="mb-1 text-gray-600">ให้พนักงานพิมพ์ข้อความนี้ใน LINE ภายใน 15 นาที:</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-blue-700">{codeInfo.code}</p>
          <p className="mt-1 text-xs text-gray-400">
            หมดอายุ: {new Date(codeInfo.expiresAt).toLocaleTimeString("th-TH")}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCodeInfo(null)} className="mt-2 h-7 px-2 text-xs text-gray-500">
            ปิด
          </Button>
        </Card>
      )}
    </div>
  )
}
