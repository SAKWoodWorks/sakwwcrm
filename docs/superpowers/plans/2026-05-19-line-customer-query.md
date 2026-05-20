# LINE Customer Query & Enhanced Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich lapsed-customer push notifications with order count and last total, and let registered salespersons query customer details by name via LINE chat.

**Architecture:** Two route files modified — `notify/route.ts` gets an enriched SQL query and new message template; `webhook/route.ts` gets a two-step routing decision (registered → customer search, unregistered → name registration). No new files. All DB access via Prisma.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7 + adapter-pg, Vitest, LINE Messaging API v2.

---

## File Map

```
src/
├── app/api/notify/route.ts          MODIFY — SQL + message format
├── app/api/line/webhook/route.ts    MODIFY — routing + customer search
└── __tests__/
    ├── notify.test.ts               MODIFY — update message assertion, add fields to mock
    └── line-webhook.test.ts         MODIFY — update existing mocks, add 3 new tests
```

---

## Task 1: Update notify — enriched SQL + message format

**Files:**
- Modify: `src/app/api/notify/route.ts`
- Modify: `src/__tests__/notify.test.ts`

### Step 1: Update the failing test first

In `src/__tests__/notify.test.ts`, the test `"sends push message for each lapsed customer"` currently asserts:
```typescript
expect(pushMessage).toHaveBeenCalledWith(
  "Uabc111",
  "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว"
)
```

Replace that assertion and update the mock data to include `order_count` and `last_total`:

```typescript
it("sends push message for each lapsed customer", async () => {
  ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      id: 1,
      customer_name: "บริษัท เคไอที จำกัด",
      line_user_id: "Uabc111",
      salesperson_name: "Pickachu",
      last_purchase: new Date("2026-01-01"),
      days_since: 137,
      order_count: BigInt(12),
      last_total: 27960,
    },
    {
      id: 2,
      customer_name: "ร้านหนึ่ง",
      line_user_id: "Uabc111",
      salesperson_name: "Pickachu",
      last_purchase: new Date("2025-12-01"),
      days_since: 168,
      order_count: BigInt(3),
      last_total: 5990,
    },
  ])
  ;(pushMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

  const res = await GET(makeRequest("my-secret"))
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data.sent).toBe(2)
  expect(data.errors).toHaveLength(0)
  expect(pushMessage).toHaveBeenCalledWith(
    "Uabc111",
    "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว\n📦 ซื้อทั้งหมด 12 ครั้ง\n💰 ยอดล่าสุด ฿27,960"
  )
  expect(pushMessage).toHaveBeenCalledWith(
    "Uabc111",
    "⚠️ ร้านหนึ่ง ไม่ได้ซื้อมา 168 วันแล้ว\n📦 ซื้อทั้งหมด 3 ครั้ง\n💰 ยอดล่าสุด ฿5,990"
  )
})
```

Also update the `LapsedCustomer` interface test mock in `"continues and records error when LINE push fails"` — add `order_count: BigInt(5), last_total: 1000` to each row there too.

- [ ] **Step 1: Update notify.test.ts**

Replace the mock data and assertion in `"sends push message for each lapsed customer"` as shown above. Add `order_count: BigInt(5), last_total: 1000` to both rows in the error-handling test.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd d:\Works\Web\crm\new-crm
npx vitest run src/__tests__/notify.test.ts
```

Expected: `"sends push message for each lapsed customer"` FAIL — message text mismatch.

- [ ] **Step 3: Update notify/route.ts**

Replace the full file content:

```typescript
import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pushMessage } from "@/lib/line"

interface LapsedCustomer {
  id: number
  customer_name: string
  line_user_id: string
  salesperson_name: string
  last_purchase: Date
  days_since: number | bigint
  order_count: number | bigint
  last_total: number | null
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
          WHERE d2.customer_id = c.id AND d2.doc_type = 'tax_invoice'
          ORDER BY d2.doc_date DESC LIMIT 1
        ) AS last_total
      FROM customers c
      JOIN salespersons s ON s.id = c.salesperson_id
      JOIN documents d ON d.customer_id = c.id AND d.doc_type = 'tax_invoice'
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
      const text = [
        `⚠️ ${row.customer_name} ไม่ได้ซื้อมา ${Number(row.days_since)} วันแล้ว`,
        `📦 ซื้อทั้งหมด ${Number(row.order_count)} ครั้ง`,
        `💰 ยอดล่าสุด ฿${lastTotalFormatted}`,
      ].join("\n")
      await pushMessage(row.line_user_id, text)
      sent++
    } catch (err) {
      console.error(`LINE push failed for customer ${row.id}:`, err)
      errors.push(`customer_id=${row.id}: ${String(err)}`)
    }
  }

  return NextResponse.json({ sent, errors })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/__tests__/notify.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notify/route.ts src/__tests__/notify.test.ts
git commit -m "feat: enrich LINE lapse notification with order count and last total"
```

---

## Task 2: Update webhook — customer search routing

**Files:**
- Modify: `src/app/api/line/webhook/route.ts`
- Modify: `src/__tests__/line-webhook.test.ts`

### Context

Current webhook logic for `message` events:
1. Find salesperson by **name** (text input) → register

New logic:
1. Find salesperson by **lineUserId** → if found: customer search mode
2. If not found by lineUserId → find by name → registration mode (unchanged)

This means `findFirst` is called **twice** in the registration path. The existing tests mock it returning a salesperson immediately — they need to be updated to return `null` on the first call (lineUserId check) then a salesperson on the second call (name check).

### Step 1: Update prisma mock and existing tests

In `src/__tests__/line-webhook.test.ts`, expand the prisma mock and fix existing tests:

```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
    },
    document: {
      aggregate: vi.fn(),
    },
  },
}))
```

Then update `import { prisma }` to include the new models (already imported via the mock).

Fix `"saves line_user_id and replies success when name matches"` — `findFirst` is now called twice: first returns `null` (not registered), second returns the salesperson:

```typescript
it("saves line_user_id and replies success when name matches", async () => {
  ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(null)           // lineUserId check → not registered
    .mockResolvedValueOnce({ id: 5, name: "Pickachu" })  // name check → found
  ;(prisma.salesperson.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

  const req = makeRequest({
    events: [
      {
        type: "message",
        replyToken: "reply-token-2",
        source: { userId: "Uabc123" },
        message: { type: "text", text: "Pickachu" },
      },
    ],
  })
  const res = await POST(req)
  expect(res.status).toBe(200)
  expect(prisma.salesperson.update).toHaveBeenCalledWith({
    where: { id: 5 },
    data: { lineUserId: "Uabc123" },
  })
  expect(replyMessage).toHaveBeenCalledWith("reply-token-2", "ลงทะเบียนสำเร็จ ✅")
})
```

Fix `"replies not-found when name does not match"` — first `findFirst` returns `null`, second also returns `null`:

```typescript
it("replies not-found when name does not match", async () => {
  ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(null)   // lineUserId check
    .mockResolvedValueOnce(null)   // name check
  // rest unchanged
})
```

- [ ] **Step 1: Update mock and fix existing tests in line-webhook.test.ts**

Apply the mock expansion and the two test fixes above.

- [ ] **Step 2: Run existing tests — expect PASS**

```bash
npx vitest run src/__tests__/line-webhook.test.ts
```

Expected: all 4 existing tests still PASS (no new tests yet).

- [ ] **Step 3: Add 3 new tests for customer search**

Append to the `describe` block in `line-webhook.test.ts`:

```typescript
describe("customer search (registered salesperson)", () => {
  beforeEach(() => {
    // salesperson IS registered (lineUserId matches)
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: "Pickachu",
      lineUserId: "Uabc123",
    })
  })

  it("replies not-found when no customers match", async () => {
    ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-search",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "ลูกค้าหายาก" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(replyMessage).toHaveBeenCalledWith(
      "reply-token-search",
      "ไม่พบลูกค้า: ลูกค้าหายาก"
    )
  })

  it("replies with name list when more than 3 customers match", async () => {
    ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `บริษัท ABC ${i + 1} จำกัด`,
        province: "Bangkok",
        type: "retail",
        documents: [],
      }))
    )

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-list",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "ABC" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const call = (replyMessage as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).toContain("พบ 5 รายการ")
    expect(call[1]).toContain("บริษัท ABC 1 จำกัด")
  })

  it("replies with customer profile when 1 customer matches", async () => {
    ;(prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 10,
        name: "บริษัท เคไอที จำกัด",
        province: "PTPU",
        type: "dealer",
        documents: [
          {
            docNumber: "258V",
            docDate: new Date("2025-03-15"),
            docType: "tax_invoice",
            total: 27960,
            paymentStatus: "paid",
          },
        ],
      },
    ])
    ;(prisma.document.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _sum: { total: 320000 },
      _count: { id: 12 },
    })

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-profile",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "เคไอที" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const call = (replyMessage as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1]).toContain("บริษัท เคไอที จำกัด")
    expect(call[1]).toContain("PTPU")
    expect(call[1]).toContain("12 ครั้ง")
    expect(call[1]).toContain("258V")
    expect(call[1]).toContain("✅")
  })
})
```

- [ ] **Step 4: Run new tests — expect FAIL**

```bash
npx vitest run src/__tests__/line-webhook.test.ts
```

Expected: 3 new tests FAIL — `prisma.customer` and `prisma.document` not used in route yet.

- [ ] **Step 5: Implement customer search in webhook/route.ts**

Replace the full file:

```typescript
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
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })
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
      const agg = await prisma.document.aggregate({
        where: { customerId: c.id, docType: "tax_invoice" },
        _sum: { total: true },
        _count: { id: true },
      })
      const totalSpend = Number(agg._sum.total ?? 0)
      const invoiceCount = agg._count.id
      const lastDate = c.documents[0]?.docDate
      const lastDateStr = lastDate ? fmtDate(lastDate) : "—"

      const docLines = c.documents
        .map((d) => {
          const icon =
            d.paymentStatus === "paid" ? "✅" : "⏳"
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
```

- [ ] **Step 6: Run all tests — expect PASS**

```bash
npx vitest run src/__tests__/line-webhook.test.ts src/__tests__/notify.test.ts
```

Expected: all 7 webhook tests + all 5 notify tests PASS (12 total).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/line/webhook/route.ts src/__tests__/line-webhook.test.ts
git commit -m "feat: LINE chat customer search for registered salespersons"
```
