"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/i18n/navigation"
import { Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export default function ProductDeleteButton({ id, name }: { id: number; name: string }) {
  const t = useTranslations("Products.actions")
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(t("deleteConfirm", { name }))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert((json as { error?: string }).error ?? t("deleteFailed"))
        return
      }
      router.refresh()
    } catch {
      alert(t("deleteFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="icon-sm"
      onClick={handleDelete}
      disabled={loading}
      title={t("delete")}
      aria-label={t("delete")}
    >
      <Trash2 />
    </Button>
  )
}
