import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { pushMessage } from "@/lib/line"
import { draftFollowUpMessage } from "@/lib/ai"

interface LapsedCustomer {
  id: number
  customer_name: string
  line_user_id: string
  salesperson_name: string
  last_purchase: Date
  days_since: number | bigint
  order_count: number | bigint
  last_total: Prisma.Decimal | number | null
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.alloc(bufA.length)
  Buffer.from(b).copy(bufB)
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token")
  const secret = process.env.NOTIFY_SECRET
  if (!secret || !token || !timingSafeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let rows: LapsedCustomer[]
  try {
    rows = await prisma.$queryRaw<LapsedCustomer[]>`
      SELECT
        c.id,
        c.name AS customer_name,
        s.line_user_id,
        s.name AS salesperson_name,
        MAX(d.doc_date) AS last_purchase,
        (CURRENT_DATE - MAX(d.doc_date)) AS days_since,
        COUNT(d.id) AS order_count,
        (
          SELECT d2.total FROM documents d2
          WHERE d2.customer_id = c.id AND d2.doc_type IN ('tax_invoice', 'abb_invoice')
          ORDER BY d2.doc_date DESC LIMIT 1
        ) AS last_total
      FROM customers c
      JOIN salespersons s ON s.id = c.salesperson_id
      JOIN documents d ON d.customer_id = c.id AND d.doc_type IN ('tax_invoice', 'abb_invoice')
      WHERE s.line_user_id IS NOT NULL
      GROUP BY c.id, c.name, s.id, s.line_user_id, s.name
      HAVING (CURRENT_DATE - MAX(d.doc_date)) >= 90
      ORDER BY s.id, days_since DESC
    `
  } catch (err) {
    console.error("Notify DB query failed:", err)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const lastTotalFormatted = row.last_total != null
        ? Number(row.last_total).toLocaleString("th-TH")
        : "—"
      const templateText = [
        `⚠️ ${row.customer_name} ไม่ได้ซื้อมา ${Number(row.days_since)} วันแล้ว`,
        `📦 ซื้อทั้งหมด ${Number(row.order_count)} ครั้ง`,
        `💰 ยอดล่าสุด ฿${lastTotalFormatted}`,
      ].join("\n")
      let aiMessage: string | null = null
      try {
        aiMessage = await draftFollowUpMessage({
          customerName: row.customer_name,
          salespersonName: row.salesperson_name,
          daysSince: Number(row.days_since),
          orderCount: Number(row.order_count),
          lastTotal: row.last_total != null ? Number(row.last_total) : null,
        })
      } catch (err) {
        console.error(`AI draft failed for customer ${row.id}:`, err)
      }
      await pushMessage(row.line_user_id, aiMessage ?? templateText)
      sent++
    } catch (err) {
      console.error(`LINE push failed for customer ${row.id}:`, err)
      errors.push(`customer_id=${row.id}: ${String(err)}`)
    }
  }

  return NextResponse.json({ sent, errors })
}
