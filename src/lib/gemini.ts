import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from "@google/generative-ai"
import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

const SYSTEM_INSTRUCTION = `You are a CRM assistant for a Thai timber and wood-products company. Answer questions about customers, sales, deals, and products using the provided tools. Always respond in the same language the user writes in (Thai, English, or Russian). Be concise. Format currency as Thai Baht with commas (e.g. ฿1,234,567). Format dates as DD/MM/YYYY. Never make up data — only report what the tools return.`

export const toolDeclarations = [
  {
    name: "get_dashboard_stats",
    description: "Get overview stats: total customers, active deals, this month revenue in THB, lapsed customers (no purchase in 90+ days)",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] as string[] },
  },
  {
    name: "get_top_customers",
    description: "Get top customers ranked by revenue. Optionally filter by month and/or year.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "How many customers to return (default 5)" },
        month: { type: SchemaType.NUMBER, description: "Month 1-12 (optional)" },
        year: { type: SchemaType.NUMBER, description: "4-digit year e.g. 2026 (optional)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_customer_info",
    description: "Search a customer by name and return their purchase history summary",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Customer name (substring, case-insensitive)" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_deal_pipeline",
    description: "Get open deals grouped by stage with deal count, total value, and weighted forecast",
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] as string[] },
  },
  {
    name: "get_monthly_revenue",
    description: "Get revenue per month for a given year",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        year: { type: SchemaType.NUMBER, description: "4-digit year (default: current year)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_lapsed_customers",
    description: "Get customers who have not made a purchase recently",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: { type: SchemaType.NUMBER, description: "Days since last purchase threshold (default 90)" },
        limit: { type: SchemaType.NUMBER, description: "Max results (default 10)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_top_products",
    description: "Get top-selling products by revenue. Optionally filter by month and/or year.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "How many products to return (default 5)" },
        month: { type: SchemaType.NUMBER, description: "Month 1-12 (optional)" },
        year: { type: SchemaType.NUMBER, description: "4-digit year e.g. 2026 (optional)" },
      },
      required: [] as string[],
    },
  },
]

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (name === "get_dashboard_stats") {
    const [customerCount, activeDeals, revenueResult, lapsedResult] = await Promise.all([
      prisma.customer.count(),
      prisma.deal.count({ where: { stage: { notIn: ["won", "lost"] } } }),
      prisma.document.aggregate({
        where: {
          docType: { in: ["tax_invoice", "abb_invoice"] },
          docDate: { gte: new Date(currentYear, now.getMonth(), 1) },
        },
        _sum: { total: true },
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT c.id) AS count
        FROM customers c
        WHERE EXISTS (
          SELECT 1 FROM documents d
          WHERE d.customer_id = c.id
            AND d.doc_type IN ('tax_invoice', 'abb_invoice')
        )
        AND NOT EXISTS (
          SELECT 1 FROM documents d
          WHERE d.customer_id = c.id
            AND d.doc_type IN ('tax_invoice', 'abb_invoice')
            AND d.doc_date >= CURRENT_DATE - INTERVAL '90 days'
        )
      `,
    ])
    return {
      total_customers: customerCount,
      active_deals: activeDeals,
      monthly_revenue_thb: Number(revenueResult._sum.total ?? 0),
      lapsed_customers: Number(lapsedResult[0]?.count ?? 0),
    }
  }

  if (name === "get_top_customers") {
    const limit = Math.min(Number(args.limit ?? 5), 20)
    const month = args.month ? Number(args.month) : null
    const year = args.year ? Number(args.year) : null

    type Row = { name: string; total: Prisma.Decimal }
    let rows: Row[]

    if (month && year) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT c.name, COALESCE(SUM(d.total), 0) AS total
        FROM customers c JOIN documents d ON d.customer_id = c.id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(MONTH FROM d.doc_date) = ${month}
          AND EXTRACT(YEAR FROM d.doc_date) = ${year}
        GROUP BY c.id, c.name ORDER BY total DESC LIMIT ${limit}
      `
    } else if (year) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT c.name, COALESCE(SUM(d.total), 0) AS total
        FROM customers c JOIN documents d ON d.customer_id = c.id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(YEAR FROM d.doc_date) = ${year}
        GROUP BY c.id, c.name ORDER BY total DESC LIMIT ${limit}
      `
    } else if (month) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT c.name, COALESCE(SUM(d.total), 0) AS total
        FROM customers c JOIN documents d ON d.customer_id = c.id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(MONTH FROM d.doc_date) = ${month}
          AND EXTRACT(YEAR FROM d.doc_date) = ${currentYear}
        GROUP BY c.id, c.name ORDER BY total DESC LIMIT ${limit}
      `
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT c.name, COALESCE(SUM(d.total), 0) AS total
        FROM customers c JOIN documents d ON d.customer_id = c.id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
        GROUP BY c.id, c.name ORDER BY total DESC LIMIT ${limit}
      `
    }
    return rows.map((r, i) => ({ rank: i + 1, name: r.name, revenue_thb: Number(r.total) }))
  }

  if (name === "get_customer_info") {
    const nameQuery = String(args.name ?? "")
    const customer = await prisma.customer.findFirst({
      where: { name: { contains: nameQuery, mode: "insensitive" } },
      select: { id: true, name: true, province: true, status: true },
    })
    if (!customer) return { found: false, searched_name: nameQuery }

    type DocRow = { order_count: bigint; last_date: Date | null; lifetime_thb: Prisma.Decimal }
    const [docRow] = await prisma.$queryRaw<DocRow[]>`
      SELECT COUNT(*) AS order_count, MAX(doc_date) AS last_date, COALESCE(SUM(total), 0) AS lifetime_thb
      FROM documents
      WHERE customer_id = ${customer.id}
        AND doc_type IN ('tax_invoice', 'abb_invoice')
    `
    return {
      found: true,
      name: customer.name,
      province: customer.province ?? "—",
      status: customer.status,
      order_count: Number(docRow.order_count),
      last_purchase_date: docRow.last_date
        ? docRow.last_date.toISOString().slice(0, 10)
        : null,
      lifetime_revenue_thb: Number(docRow.lifetime_thb),
    }
  }

  if (name === "get_deal_pipeline") {
    const deals = await prisma.deal.findMany({
      where: { stage: { notIn: ["won", "lost"] } },
      select: { stage: true, expectedValue: true, probability: true },
    })
    const byStage: Record<string, { count: number; total: number; weighted: number }> = {}
    for (const d of deals) {
      if (!byStage[d.stage]) byStage[d.stage] = { count: 0, total: 0, weighted: 0 }
      const val = Number(d.expectedValue ?? 0)
      byStage[d.stage].count++
      byStage[d.stage].total += val
      byStage[d.stage].weighted += (val * d.probability) / 100
    }
    const stages = Object.entries(byStage).map(([stage, s]) => ({ stage, ...s }))
    const totalWeighted = stages.reduce((sum, s) => sum + s.weighted, 0)
    return { stages, total_weighted_forecast_thb: totalWeighted }
  }

  if (name === "get_monthly_revenue") {
    const year = Number(args.year ?? currentYear)
    type Row = { month: number; revenue: Prisma.Decimal }
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT EXTRACT(MONTH FROM doc_date)::int AS month, COALESCE(SUM(total), 0) AS revenue
      FROM documents
      WHERE doc_type IN ('tax_invoice', 'abb_invoice')
        AND EXTRACT(YEAR FROM doc_date) = ${year}
      GROUP BY month ORDER BY month
    `
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    const result: Record<string, number> = {}
    for (const r of rows) result[monthNames[r.month - 1]] = Number(r.revenue)
    return { year, monthly_revenue_thb: result }
  }

  if (name === "get_lapsed_customers") {
    const days = Number(args.days ?? 90)
    const limit = Math.min(Number(args.limit ?? 10), 50)
    type Row = { name: string; last_date: Date }
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT c.name, MAX(d.doc_date) AS last_date
      FROM customers c JOIN documents d ON d.customer_id = c.id
      WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
      GROUP BY c.id, c.name
      HAVING MAX(d.doc_date) < CURRENT_DATE - (${days} || ' days')::interval
      ORDER BY last_date ASC
      LIMIT ${limit}
    `
    return rows.map(r => ({
      name: r.name,
      last_purchase_date: r.last_date.toISOString().slice(0, 10),
    }))
  }

  if (name === "get_top_products") {
    const limit = Math.min(Number(args.limit ?? 5), 20)
    const month = args.month ? Number(args.month) : null
    const year = args.year ? Number(args.year) : null

    type Row = { product_name: string; sku_code: string | null; revenue: Prisma.Decimal }
    let rows: Row[]

    if (month && year) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT COALESCE(p.full_name, di.description, 'Unknown') AS product_name,
               p.sku_code,
               COALESCE(SUM(di.total), 0) AS revenue
        FROM document_items di
        JOIN documents d ON d.id = di.document_id
        LEFT JOIN products p ON p.id = di.product_id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(MONTH FROM d.doc_date) = ${month}
          AND EXTRACT(YEAR FROM d.doc_date) = ${year}
        GROUP BY COALESCE(p.full_name, di.description, 'Unknown'), p.sku_code ORDER BY revenue DESC LIMIT ${limit}
      `
    } else if (year) {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT COALESCE(p.full_name, di.description, 'Unknown') AS product_name,
               p.sku_code,
               COALESCE(SUM(di.total), 0) AS revenue
        FROM document_items di
        JOIN documents d ON d.id = di.document_id
        LEFT JOIN products p ON p.id = di.product_id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(YEAR FROM d.doc_date) = ${year}
        GROUP BY COALESCE(p.full_name, di.description, 'Unknown'), p.sku_code ORDER BY revenue DESC LIMIT ${limit}
      `
    } else {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT COALESCE(p.full_name, di.description, 'Unknown') AS product_name,
               p.sku_code,
               COALESCE(SUM(di.total), 0) AS revenue
        FROM document_items di
        JOIN documents d ON d.id = di.document_id
        LEFT JOIN products p ON p.id = di.product_id
        WHERE d.doc_type IN ('tax_invoice', 'abb_invoice')
          AND EXTRACT(MONTH FROM d.doc_date) = ${currentMonth}
          AND EXTRACT(YEAR FROM d.doc_date) = ${currentYear}
        GROUP BY COALESCE(p.full_name, di.description, 'Unknown'), p.sku_code ORDER BY revenue DESC LIMIT ${limit}
      `
    }
    return rows.map((r, i) => ({ rank: i + 1, product: r.product_name, sku: r.sku_code ?? "—", revenue_thb: Number(r.revenue) }))
  }

  return { error: `Unknown tool: ${name}` }
}

export function createGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: toolDeclarations as FunctionDeclaration[] }],
  })
}
