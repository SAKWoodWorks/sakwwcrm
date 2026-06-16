export const dynamic = "force-dynamic"

import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { Pencil } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { Suspense } from "react"
import ProductCategoryBadge from "./ProductCategoryBadge"
import ProductDeleteButton from "./ProductDeleteButton"
import ProductFilter from "./ProductFilter"

type Props = {
  searchParams: Promise<{ category?: string; bestMonth?: string; bestYear?: string }>
}

type TopProductRow = {
  product_id: number | null
  sku_code: string | null
  product_name: string | null
  description: string | null
  sold_qty: Prisma.Decimal | number
  sold_amount: Prisma.Decimal | number
  invoice_count: bigint
}

type CategoryRow = {
  category: string | null
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category, bestMonth, bestYear } = await searchParams
  const [t, locale] = await Promise.all([getTranslations("Products"), getLocale()])
  const localeTag = toLocaleTag(locale)
  const selectedMonth = getSelectedMonth(bestMonth, bestYear)
  const monthStart = new Date(Date.UTC(selectedMonth.year, selectedMonth.month - 1, 1))
  const nextMonthStart = new Date(Date.UTC(selectedMonth.year, selectedMonth.month, 1))

  const where = category ? { category } : {}

  const [categoryRows, products, topProducts] = await Promise.all([
    prisma.$queryRaw<CategoryRow[]>`
      SELECT DISTINCT category
      FROM products
      WHERE category IS NOT NULL
        AND btrim(category) <> ''
      ORDER BY category ASC
    `,
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { skuCode: "asc" }],
      select: {
        id: true,
        skuCode: true,
        fullName: true,
        category: true,
        grade: true,
        thickness: true,
        width: true,
        length: true,
        wsCost: true,
        rtCost: true,
      },
    }),
    prisma.$queryRaw<TopProductRow[]>`
      SELECT
        di.product_id,
        p.sku_code,
        p.full_name AS product_name,
        CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END AS description,
        COALESCE(SUM(di.quantity), 0) AS sold_qty,
        COALESCE(SUM(di.total), 0) AS sold_amount,
        COUNT(DISTINCT d.id) AS invoice_count
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      LEFT JOIN products p ON p.id = di.product_id
      WHERE d.doc_type = 'tax_invoice'
        AND d.payment_status = 'paid'
        AND d.doc_date >= ${monthStart}
        AND d.doc_date < ${nextMonthStart}
      GROUP BY di.product_id, p.sku_code, p.full_name, CASE WHEN di.product_id IS NULL THEN di.description ELSE NULL END
      ORDER BY sold_amount DESC
      LIMIT 10
    `,
  ])
  const categoryOptions = categoryRows.map((row) => row.category).filter((value): value is string => Boolean(value))

  return (
    <div className="crm-page">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Suspense>
          <ProductFilter categories={categoryOptions} />
        </Suspense>
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--crm-ink)]">{t("best.title")}</h2>
            <p className="mt-1 text-sm text-[var(--crm-muted)]">{t("best.description")}</p>
          </div>
          <BestProductMonthForm
            selectedMonth={selectedMonth.month}
            selectedYear={selectedMonth.year}
            category={category}
            locale={locale}
            labels={{
              month: t("best.month"),
              year: t("best.year"),
              submit: t("best.submit"),
            }}
          />
        </div>
        <div className="crm-mobile-list">
          {topProducts.length === 0 ? (
            <Card className="rounded-lg border-[var(--crm-line)] bg-white p-4 text-center text-sm text-[var(--crm-muted)] shadow-[var(--crm-shadow)]">
              {t("best.empty")}
            </Card>
          ) : (
            topProducts.map((row, index) => (
              <Card key={`${row.product_id ?? "desc"}-${row.sku_code ?? row.description}-${index}`} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--crm-muted)]">#{index + 1}</p>
                    {row.product_id ? (
                      <Link href={`/crm/products/${row.product_id}`} className="mt-1 line-clamp-2 font-semibold text-[var(--crm-ink)] hover:text-[var(--crm-brand)]">
                        {topProductName(row, t("unknownProduct"))}
                      </Link>
                    ) : (
                      <h3 className="mt-1 line-clamp-2 font-semibold text-[var(--crm-ink)]">{topProductName(row, t("unknownProduct"))}</h3>
                    )}
                    <p className="mt-1 font-mono text-xs text-[var(--crm-brand)]">{row.sku_code ?? t("unlinkedSku")}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-bold tabular-nums text-[#7a5614]">{formatBaht(row.sold_amount, localeTag)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">{t("table.quantity")}</p>
                    <p className="font-semibold tabular-nums">{formatQty(row.sold_qty, localeTag)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--crm-muted)]">{t("table.invoice")}</p>
                    <p className="font-semibold tabular-nums">{Number(row.invoice_count).toLocaleString(localeTag)}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        <div className="crm-table-wrap crm-desktop-table">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-4 py-3 text-gray-500">#</TableHead>
                <TableHead className="px-4 py-3 text-gray-500">{t("table.product")}</TableHead>
                <TableHead className="px-4 py-3 text-gray-500">{t("table.sku")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.quantity")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.invoice")}</TableHead>
                <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    {t("best.empty")}
                  </TableCell>
                </TableRow>
              ) : topProducts.map((row, index) => (
                <TableRow key={`${row.product_id ?? "desc"}-${row.sku_code ?? row.description}-${index}`} className="hover:bg-gray-50">
                  <TableCell className="px-4 py-3 tabular-nums text-gray-400">{index + 1}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-gray-900">
                    {row.product_id ? (
                      <Link href={`/crm/products/${row.product_id}`} className="hover:text-[var(--crm-brand)] hover:underline">
                        {topProductName(row, t("unknownProduct"))}
                      </Link>
                    ) : (
                      topProductName(row, t("unknownProduct"))
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs text-gray-600">{row.sku_code ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{formatQty(row.sold_qty, localeTag)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">{Number(row.invoice_count).toLocaleString(localeTag)}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums font-semibold text-[#7a5614]">{formatBaht(row.sold_amount, localeTag)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mb-2 text-sm text-gray-500">{t("count", { count: products.length })}</div>

      <div className="crm-mobile-list">
        {products.map((p) => (
          <Card key={p.id} className="rounded-lg border-[var(--crm-line)] bg-white p-4 shadow-[var(--crm-shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-[var(--crm-brand)]">{p.skuCode}</p>
                <Link href={`/crm/products/${p.id}`} className="mt-1 line-clamp-2 font-semibold text-[var(--crm-ink)] hover:text-[var(--crm-brand)]">
                  {p.fullName}
                </Link>
              </div>
              {p.category ? <ProductCategoryBadge category={p.category} /> : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-[var(--crm-muted)]">{t("table.grade")}</p>
                <p className="font-medium">{p.grade ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">{t("table.size")}</p>
                <p className="font-medium tabular-nums">{p.thickness && p.width && p.length ? `${p.thickness}×${p.width}×${p.length}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">{t("table.wholesale")}</p>
                <p className="font-semibold tabular-nums">{p.wsCost != null ? Number(p.wsCost).toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--crm-muted)]">{t("table.retail")}</p>
                <p className="font-semibold tabular-nums">{p.rtCost != null ? Number(p.rtCost).toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button asChild variant="outline" size="icon-sm">
                <Link href={`/crm/products/${p.id}/edit`} title={t("editProduct")} aria-label={t("editProduct")}>
                  <Pencil />
                </Link>
              </Button>
              <ProductDeleteButton id={p.id} name={p.fullName} />
            </div>
          </Card>
        ))}
      </div>

      <div className="crm-table-wrap crm-desktop-table">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.sku")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.productName")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.category")}</TableHead>
              <TableHead className="px-4 py-3 text-gray-500">{t("table.grade")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.size")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.wholesale")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.retail")}</TableHead>
              <TableHead className="px-4 py-3 text-right text-gray-500">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} className="hover:bg-gray-50">
                <TableCell className="px-4 py-3 font-mono text-xs text-gray-600">{p.skuCode}</TableCell>
                <TableCell className="px-4 py-3 text-gray-900">
                  <Link href={`/crm/products/${p.id}`} className="hover:text-[var(--crm-brand)] hover:underline">
                    {p.fullName}
                  </Link>
                </TableCell>
                <TableCell className="px-4 py-3">
                  {p.category ? <ProductCategoryBadge category={p.category} /> : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-gray-500">{p.grade ?? "—"}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {p.thickness && p.width && p.length
                    ? `${p.thickness}×${p.width}×${p.length}`
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {p.wsCost != null
                    ? Number(p.wsCost).toLocaleString(localeTag, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {p.rtCost != null
                    ? Number(p.rtCost).toLocaleString(localeTag, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={`/crm/products/${p.id}/edit`} title={t("editProduct")} aria-label={t("editProduct")}>
                        <Pencil />
                      </Link>
                    </Button>
                    <ProductDeleteButton id={p.id} name={p.fullName} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function topProductName(row: TopProductRow, fallback: string) {
  return row.product_name ?? row.description ?? fallback
}

function formatBaht(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
  })
}

function formatQty(value: Prisma.Decimal | number, locale: string) {
  return Number(value).toLocaleString(locale, {
    maximumFractionDigits: 3,
  })
}

function BestProductMonthForm({
  selectedMonth,
  selectedYear,
  category,
  locale,
  labels,
}: {
  selectedMonth: number
  selectedYear: number
  category?: string
  locale: string
  labels: {
    month: string
    year: string
    submit: string
  }
}) {
  const years = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 1 - index)
  const localeTag = toLocaleTag(locale)

  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">{labels.month}</span>
        <select
          name="bestMonth"
          defaultValue={String(selectedMonth)}
          className="h-10 rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {formatMonthName(month, localeTag)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--crm-muted)]">{labels.year}</span>
        <select
          name="bestYear"
          defaultValue={String(selectedYear)}
          className="h-10 rounded-md border border-[var(--crm-line)] bg-white px-3 text-sm"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {formatYear(year, localeTag)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline" className="h-10">
        {labels.submit}
      </Button>
    </form>
  )
}

function getSelectedMonth(monthParam?: string, yearParam?: string) {
  const today = new Date()
  const month = Number(monthParam)
  const year = Number(yearParam)

  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : today.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : today.getFullYear(),
  }
}

function formatMonthName(month: number, locale: string) {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString(locale, { month: "long" })
}

function formatYear(year: number, locale: string) {
  if (locale === "th-TH") return (year + 543).toLocaleString(locale, { useGrouping: false })
  return year.toLocaleString(locale, { useGrouping: false })
}

function toLocaleTag(locale: string) {
  if (locale === "en") return "en-US"
  if (locale === "ru") return "ru-RU"
  return "th-TH"
}


