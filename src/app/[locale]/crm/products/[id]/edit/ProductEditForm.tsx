"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

type ProductData = {
  id: number
  skuCode: string
  fullName: string
  category: string | null
  grade: string | null
  thickness: string | null
  width: string | null
  length: string | null
  weight: string | null
  volume: string | null
  wsCost: string | null
  rtCost: string | null
}

export default function ProductEditForm({ product }: { product: ProductData }) {
  const t = useTranslations("ProductEdit")
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const data = new FormData(e.currentTarget)

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? t("saveFailed"))
        return
      }
      router.refresh()
      router.push("/crm/products")
    } catch {
      setError(t("saveFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("fields.sku")} name="skuCode" defaultValue={product.skuCode} required />
        <Field label={t("fields.category")} name="category" defaultValue={product.category ?? ""} />
      </div>
      <Field label={t("fields.fullName")} name="fullName" defaultValue={product.fullName} required />
      <div className="grid gap-4 md:grid-cols-4">
        <Field label={t("fields.grade")} name="grade" defaultValue={product.grade ?? ""} />
        <Field label={t("fields.thickness")} name="thickness" defaultValue={product.thickness ?? ""} inputMode="decimal" />
        <Field label={t("fields.width")} name="width" defaultValue={product.width ?? ""} inputMode="decimal" />
        <Field label={t("fields.length")} name="length" defaultValue={product.length ?? ""} inputMode="decimal" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Field label={t("fields.weight")} name="weight" defaultValue={product.weight ?? ""} inputMode="decimal" />
        <Field label={t("fields.volume")} name="volume" defaultValue={product.volume ?? ""} inputMode="decimal" />
        <Field label={t("fields.wholesale")} name="wsCost" defaultValue={product.wsCost ?? ""} inputMode="decimal" />
        <Field label={t("fields.retail")} name="rtCost" defaultValue={product.rtCost ?? ""} inputMode="decimal" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]">
          {loading ? t("saving") : t("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/crm/products">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  required,
  inputMode,
}: {
  label: string
  name: string
  defaultValue: string
  required?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <Input
        name={name}
        defaultValue={defaultValue}
        required={required}
        inputMode={inputMode}
        className="h-11 bg-white"
      />
    </label>
  )
}
