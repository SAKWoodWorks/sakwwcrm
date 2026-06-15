"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

interface Props {
  salespersonId: number
  lineUserId: string | null
}

export default function SalespersonLineManage({ salespersonId, lineUserId }: Props) {
  const t = useTranslations("Salespersons.line")
  const locale = toLocaleTag(useLocale())
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [codeInfo, setCodeInfo] = useState<{ code: string; expiresAt: string } | null>(null)
  const [unlinkOpen, setUnlinkOpen] = useState(false)

  async function handleUnlink() {
    setLoading(true)
    try {
      const res = await fetch(`/api/salespersons/${salespersonId}/line`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success(t("unlinkedToast"))
      setUnlinkOpen(false)
      router.refresh()
    } catch {
      toast.error(t("error"))
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
      toast.success(t("codeToast"))
    } catch {
      toast.error(t("error"))
    } finally {
      setLoading(false)
    }
  }

  if (lineUserId) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
          {t("linked")}
        </Badge>
        <Dialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
            >
              {loading ? "..." : t("unlink")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("unlinkTitle")}</DialogTitle>
              <DialogDescription>{t("unlinkDescription")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={loading}>
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button type="button" variant="destructive" onClick={handleUnlink} disabled={loading}>
                {loading ? t("unlinking") : t("confirmUnlink")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-500">
          {t("notLinked")}
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
            {loading ? "..." : t("createCode")}
          </Button>
        )}
      </div>
      {codeInfo && (
        <Card className="border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="mb-1 text-gray-600">{t("codeInstruction")}</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-blue-700">{codeInfo.code}</p>
          <p className="mt-1 text-xs text-gray-400">
            {t("expires", { time: new Date(codeInfo.expiresAt).toLocaleTimeString(locale) })}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCodeInfo(null)} className="mt-2 h-7 px-2 text-xs text-gray-500">
            {t("close")}
          </Button>
        </Card>
      )}
    </div>
  )
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}
