export const dynamic = "force-dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import ProductEditForm from "./ProductEditForm"

type Props = { params: Promise<{ id: string }> }

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params
  const t = await getTranslations("ProductEdit")
  const productId = parseInt(id, 10)
  if (isNaN(productId) || String(productId) !== id) notFound()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      skuCode: true,
      fullName: true,
      category: true,
      grade: true,
      thickness: true,
      width: true,
      length: true,
      weight: true,
      volume: true,
      wsCost: true,
      rtCost: true,
    },
  })

  if (!product) notFound()

  const editProduct = {
    ...product,
    thickness: product.thickness != null ? String(product.thickness) : null,
    width: product.width != null ? String(product.width) : null,
    length: product.length != null ? String(product.length) : null,
    weight: product.weight != null ? String(product.weight) : null,
    volume: product.volume != null ? String(product.volume) : null,
    wsCost: product.wsCost != null ? String(product.wsCost) : null,
    rtCost: product.rtCost != null ? String(product.rtCost) : null,
  }

  return (
    <div className="crm-page max-w-3xl">
      <div className="mb-4">
        <Link href="/crm/products" className="text-sm text-blue-600 hover:underline">
          {t("back")}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <Card className="rounded-lg border-[var(--crm-line)] bg-white shadow-[var(--crm-shadow)]">
        <CardContent className="p-6">
          <ProductEditForm product={editProduct} />
        </CardContent>
      </Card>
    </div>
  )
}
