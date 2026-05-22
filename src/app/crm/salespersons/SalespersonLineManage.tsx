"use client"

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
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          ✅ LINE ลงทะเบียนแล้ว
        </span>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {loading ? "..." : "ยกเลิก LINE"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          ยังไม่ลงทะเบียน LINE
        </span>
        {!codeInfo && (
          <button
            onClick={handleGenerateCode}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {loading ? "..." : "สร้าง Link Code"}
          </button>
        )}
      </div>
      {codeInfo && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="mb-1 text-gray-600">ให้พนักงานพิมพ์ข้อความนี้ใน LINE ภายใน 15 นาที:</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-blue-700">{codeInfo.code}</p>
          <p className="mt-1 text-xs text-gray-400">
            หมดอายุ: {new Date(codeInfo.expiresAt).toLocaleTimeString("th-TH")}
          </p>
          <button onClick={() => setCodeInfo(null)} className="mt-2 text-xs text-gray-500 hover:underline">
            ปิด
          </button>
        </div>
      )}
    </div>
  )
}
