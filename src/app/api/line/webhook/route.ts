import { NextRequest, NextResponse } from "next/server"
import { verifySignature, replyMessage } from "@/lib/line"
import { prisma } from "@/lib/prisma"

interface LineEvent {
  type: string
  replyToken?: string
  source?: { userId: string }
  message?: { type: string; text: string }
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH")
}

async function handleCustomerSearch(replyToken: string, text: string): Promise<void> {
  const customers = await prisma.customer.findMany({
    where: { name: { contains: text, mode: "insensitive" } },
    take: 10,
    include: {
      documents: {
        where: { docType: "tax_invoice" },
        orderBy: { docDate: "desc" },
        take: 5,
        select: {
          docNumber: true,
          docDate: true,
          docType: true,
          total: true,
          paymentStatus: true,
        },
      },
    },
  })

  if (customers.length === 0) {
    await replyMessage(replyToken, `ไม่พบลูกค้า: ${text}`)
    return
  }

  if (customers.length > 3) {
    const names = customers.map((c) => `• ${c.name}`).join("\n")
    await replyMessage(replyToken, `พบ ${customers.length} รายการ กรุณาพิมพ์ชื่อให้แม่นยำขึ้น:\n${names}`)
    return
  }

  const parts = await Promise.all(
    customers.map(async (c) => {
      const [agg, invoiceCount] = await Promise.all([
        prisma.document.aggregate({
          where: { customerId: c.id, docType: "tax_invoice" },
          _sum: { total: true },
        }),
        prisma.document.count({
          where: { customerId: c.id, docType: "tax_invoice" },
        }),
      ])
      const totalSpend = Number(agg._sum.total ?? 0)
      const lastDate = c.documents[0]?.docDate
      const lastDateStr = lastDate ? fmtDate(lastDate) : "—"

      const docLines = c.documents
        .map((d) => {
          const icon = d.paymentStatus === "paid" ? "✅" : "⏳"
          return `• ${d.docNumber} | ${fmtDate(d.docDate)} | ฿${fmtMoney(Number(d.total ?? 0))} ${icon}`
        })
        .join("\n")

      return [
        `👤 ${c.name}`,
        `📍 ${c.province ?? "—"} | ${c.type ?? "—"}`,
        `🛒 ซื้อ ${invoiceCount} ครั้ง | ล่าสุด ${lastDateStr}`,
        `💰 ยอดรวม ฿${fmtMoney(totalSpend)}`,
        ``,
        `เอกสาร 5 รายการล่าสุด:`,
        docLines || "—",
      ].join("\n")
    })
  )

  const reply = parts.join("\n\n---\n\n").slice(0, 4999)
  await replyMessage(replyToken, reply)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get("x-line-signature") ?? ""

  if (!verifySignature(rawBody, signature)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  let events: LineEvent[] = []
  try {
    const body = JSON.parse(rawBody)
    events = body.events ?? []
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  for (const event of events) {
    try {
      if (event.type === "follow") {
        await replyMessage(
          event.replyToken ?? "",
          "กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน (เช่น Pickachu)"
        )
      } else if (event.type === "message" && event.message?.type === "text") {
        const userId = event.source?.userId ?? ""
        const inputText = event.message.text.trim()

        // Check if this LINE user is already a registered salesperson
        const registered = await prisma.salesperson.findFirst({
          where: { lineUserId: userId },
        })

        if (registered) {
          await handleCustomerSearch(event.replyToken ?? "", inputText)
        } else {
          // Registration flow: treat message as salesperson name
          const salesperson = await prisma.salesperson.findFirst({
            where: { name: { equals: inputText, mode: "insensitive" } },
          })
          if (salesperson) {
            await prisma.salesperson.update({
              where: { id: salesperson.id },
              data: { lineUserId: userId },
            })
            await replyMessage(event.replyToken ?? "", "ลงทะเบียนสำเร็จ ✅")
          } else {
            await replyMessage(event.replyToken ?? "", "ไม่พบชื่อในระบบ กรุณาลองใหม่")
          }
        }
      }
    } catch (err) {
      console.error("LINE webhook event processing error:", err)
    }
  }

  return new NextResponse(null, { status: 200 })
}
