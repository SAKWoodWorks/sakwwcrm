# LINE Salesperson Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send daily LINE push messages to salespersons listing their customers who haven't purchased in 90+ days, with a webhook endpoint for self-registration via LINE bot.

**Architecture:** Three focused units — a pure LINE API helper (`src/lib/line.ts`), a webhook route that handles LINE bot events for salesperson self-registration (`src/app/api/line/webhook/route.ts`), and a notify route that queries lapsed customers and sends push messages (`src/app/api/notify/route.ts`). A cron-job.org job calls the notify route daily at 01:00 UTC (08:00 Bangkok).

**Tech Stack:** Next.js 16 App Router route handlers, Prisma `$queryRaw` (PostgreSQL), Node.js `crypto` module (HMAC-SHA256 signature), native `fetch` (LINE Messaging API v2), Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/line.ts` | **Create** | `verifySignature`, `pushMessage`, `replyMessage` — pure LINE API helpers |
| `src/app/api/line/webhook/route.ts` | **Create** | POST handler: validate signature, handle follow/message events |
| `src/app/api/notify/route.ts` | **Create** | GET handler: auth check, query lapsed customers, send LINE push |
| `src/__tests__/line-client.test.ts` | **Create** | Unit tests for `verifySignature`, `pushMessage`, `replyMessage` |
| `src/__tests__/line-webhook.test.ts` | **Create** | Unit tests for webhook POST handler |
| `src/__tests__/notify.test.ts` | **Create** | Unit tests for notify GET handler |
| `.env.local` | **Modify** | Add `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `NOTIFY_SECRET` |

No schema changes needed — `salespersons.line_user_id` column already exists (maps to `Salesperson.lineUserId` in Prisma).

---

### Task 1: LINE API Helper (`src/lib/line.ts`)

**Files:**
- Create: `src/lib/line.ts`
- Test: `src/__tests__/line-client.test.ts`

**Background:** Wraps the LINE Messaging API v2 with three exported functions:
- `verifySignature(rawBody, signature)` — HMAC-SHA256 using `LINE_CHANNEL_SECRET`, compared against `x-line-signature` header
- `pushMessage(userId, text)` — sends a text message to a user (no reply token needed)
- `replyMessage(replyToken, text)` — replies within the same webhook event (reply token expires quickly)

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/line-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import crypto from "crypto"

vi.mock("@/lib/line", async (importOriginal) => {
  return await importOriginal()
})

describe("verifySignature", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "test-secret")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true for valid HMAC-SHA256 signature", async () => {
    const { verifySignature } = await import("@/lib/line")
    const body = "hello"
    const expected = crypto
      .createHmac("sha256", "test-secret")
      .update(body)
      .digest("base64")
    expect(verifySignature(body, expected)).toBe(true)
  })

  it("returns false for wrong signature", async () => {
    const { verifySignature } = await import("@/lib/line")
    expect(verifySignature("hello", "bad-signature")).toBe(false)
  })
})

describe("pushMessage", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token")
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("calls LINE push API with correct payload", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })
    const { pushMessage } = await import("@/lib/line")
    await pushMessage("U123", "test message")

    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          to: "U123",
          messages: [{ type: "text", text: "test message" }],
        }),
      })
    )
  })

  it("throws on non-ok response", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    })
    const { pushMessage } = await import("@/lib/line")
    await expect(pushMessage("U123", "test")).rejects.toThrow("LINE push failed: 429")
  })
})

describe("replyMessage", () => {
  beforeEach(() => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token")
    vi.stubGlobal("fetch", vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("calls LINE reply API with correct payload", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })
    const { replyMessage } = await import("@/lib/line")
    await replyMessage("reply-token-xyz", "hello")

    expect(fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/reply",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          replyToken: "reply-token-xyz",
          messages: [{ type: "text", text: "hello" }],
        }),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/__tests__/line-client.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/line'`

- [ ] **Step 3: Create `src/lib/line.ts`**

```typescript
import crypto from "crypto"

const LINE_API = "https://api.line.me/v2/bot/message"

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` }
}

export function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  return digest === signature
}

export async function pushMessage(userId: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/push`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE push failed: ${res.status} ${body}`)
  }
}

export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const res = await fetch(`${LINE_API}/reply`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE reply failed: ${res.status} ${body}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/__tests__/line-client.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/line.ts src/__tests__/line-client.test.ts
git commit -m "feat: add LINE API helper (push, reply, signature verification)"
```

---

### Task 2: Webhook Route (`src/app/api/line/webhook/route.ts`)

**Files:**
- Create: `src/app/api/line/webhook/route.ts`
- Test: `src/__tests__/line-webhook.test.ts`

**Background:** LINE sends POST requests here for every bot event. Two events matter:

1. `follow` — someone adds the bot as a friend → reply asking for their name
2. `message` (text type) — user sends text → match case-insensitively against `salespersons.name` → if found, save their LINE userId and reply success; if not found, reply with error

Signature validation: LINE signs every request body with HMAC-SHA256 using the channel secret, sends result as base64 in `x-line-signature` header. The raw request body must be read as text before parsing JSON, because signature is computed on the raw bytes.

The route must return HTTP 200 for all valid requests (including events it ignores). LINE will retry on non-200.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/line-webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/line", () => ({
  verifySignature: vi.fn(),
  replyMessage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { verifySignature, replyMessage } from "@/lib/line"
import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/line/webhook/route"

function makeRequest(body: object, signature = "valid-sig"): NextRequest {
  return new NextRequest("http://localhost/api/line/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-line-signature": signature,
    },
  })
}

describe("POST /api/line/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(verifySignature as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(replyMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it("returns 401 when signature is invalid", async () => {
    ;(verifySignature as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const req = makeRequest({ events: [] }, "bad-sig")
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("replies with registration prompt on follow event", async () => {
    const req = makeRequest({
      events: [{ type: "follow", replyToken: "reply-token-1" }],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(replyMessage).toHaveBeenCalledWith(
      "reply-token-1",
      "กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน (เช่น Pickachu)"
    )
  })

  it("saves line_user_id and replies success when name matches", async () => {
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      name: "Pickachu",
    })
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

  it("replies not-found when name does not match", async () => {
    ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const req = makeRequest({
      events: [
        {
          type: "message",
          replyToken: "reply-token-3",
          source: { userId: "Uabc123" },
          message: { type: "text", text: "Unknown Name" },
        },
      ],
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(replyMessage).toHaveBeenCalledWith(
      "reply-token-3",
      "ไม่พบชื่อในระบบ กรุณาลองใหม่"
    )
    expect(prisma.salesperson.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/__tests__/line-webhook.test.ts
```
Expected: FAIL — `Cannot find module '@/app/api/line/webhook/route'`

- [ ] **Step 3: Create directory and route file**

```bash
mkdir -p src/app/api/line/webhook
```

Create `src/app/api/line/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { verifySignature, replyMessage } from "@/lib/line"
import { prisma } from "@/lib/prisma"

interface LineEvent {
  type: string
  replyToken: string
  source: { userId: string }
  message?: { type: string; text: string }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get("x-line-signature") ?? ""

  if (!verifySignature(rawBody, signature)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events: LineEvent[] = body.events ?? []

  for (const event of events) {
    if (event.type === "follow") {
      await replyMessage(
        event.replyToken,
        "กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน (เช่น Pickachu)"
      )
    } else if (event.type === "message" && event.message?.type === "text") {
      const inputName = event.message.text.trim()
      const salesperson = await prisma.salesperson.findFirst({
        where: { name: { equals: inputName, mode: "insensitive" } },
      })
      if (salesperson) {
        await prisma.salesperson.update({
          where: { id: salesperson.id },
          data: { lineUserId: event.source.userId },
        })
        await replyMessage(event.replyToken, "ลงทะเบียนสำเร็จ ✅")
      } else {
        await replyMessage(event.replyToken, "ไม่พบชื่อในระบบ กรุณาลองใหม่")
      }
    }
  }

  return new NextResponse(null, { status: 200 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/__tests__/line-webhook.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/app/api/line/webhook/route.ts src/__tests__/line-webhook.test.ts
git commit -m "feat: add LINE webhook route for salesperson self-registration"
```

---

### Task 3: Notify Route (`src/app/api/notify/route.ts`)

**Files:**
- Create: `src/app/api/notify/route.ts`
- Test: `src/__tests__/notify.test.ts`

**Background:** cron-job.org calls `GET /api/notify?token=SECRET` daily at 01:00 UTC (= 08:00 Bangkok UTC+7).

The route:
1. Validates `token` query param against `NOTIFY_SECRET` env var — returns 401 if wrong
2. Runs a raw SQL query (via `prisma.$queryRaw`) to find customers whose last `tax_invoice` document date is ≥ 90 days ago, grouped per salesperson. Only includes salespersons who have a `line_user_id`.
3. For each row, sends one LINE push message to the salesperson. If LINE API throws, logs the error and continues to the next customer.
4. Returns `{ sent: N, errors: string[] }`

The SQL uses `CURRENT_DATE - MAX(d.doc_date)` which works because `doc_date` is a PostgreSQL `DATE` column — subtracting two dates yields an integer (days). PostgreSQL's `pg` driver returns this as a JavaScript `number`.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/notify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock("@/lib/line", () => ({
  pushMessage: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { pushMessage } from "@/lib/line"
import { GET } from "@/app/api/notify/route"

function makeRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/notify?token=${token}`)
}

describe("GET /api/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NOTIFY_SECRET", "my-secret")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 for wrong token", async () => {
    const res = await GET(makeRequest("wrong"))
    expect(res.status).toBe(401)
  })

  it("sends push message for each lapsed customer", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "บริษัท เคไอที จำกัด",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 137,
      },
      {
        id: 2,
        customer_name: "ร้านหนึ่ง",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2025-12-01"),
        days_since: 168,
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
      "⚠️ บริษัท เคไอที จำกัด ไม่ได้ซื้อมา 137 วันแล้ว"
    )
    expect(pushMessage).toHaveBeenCalledWith(
      "Uabc111",
      "⚠️ ร้านหนึ่ง ไม่ได้ซื้อมา 168 วันแล้ว"
    )
  })

  it("continues and records error when LINE push fails for one customer", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 1,
        customer_name: "ลูกค้า A",
        line_user_id: "Uabc111",
        salesperson_name: "Pickachu",
        last_purchase: new Date("2026-01-01"),
        days_since: 100,
      },
      {
        id: 2,
        customer_name: "ลูกค้า B",
        line_user_id: "Uabc222",
        salesperson_name: "Ash",
        last_purchase: new Date("2025-12-01"),
        days_since: 150,
      },
    ])
    ;(pushMessage as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("LINE push failed: 429 rate limited"))
      .mockResolvedValueOnce(undefined)

    const res = await GET(makeRequest("my-secret"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(data.errors).toHaveLength(1)
    expect(data.errors[0]).toContain("customer_id=1")
  })

  it("returns 500 when DB query fails", async () => {
    ;(prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("connection refused")
    )
    const res = await GET(makeRequest("my-secret"))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/__tests__/notify.test.ts
```
Expected: FAIL — `Cannot find module '@/app/api/notify/route'`

- [ ] **Step 3: Create directory and route file**

```bash
mkdir -p src/app/api/notify
```

Create `src/app/api/notify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pushMessage } from "@/lib/line"

interface LapsedCustomer {
  id: number
  customer_name: string
  line_user_id: string
  salesperson_name: string
  last_purchase: Date
  days_since: number
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token")
  if (token !== process.env.NOTIFY_SECRET) {
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
        (CURRENT_DATE - MAX(d.doc_date)) AS days_since
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
      const text = `⚠️ ${row.customer_name} ไม่ได้ซื้อมา ${Number(row.days_since)} วันแล้ว`
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/__tests__/notify.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notify/route.ts src/__tests__/notify.test.ts
git commit -m "feat: add notify route for daily LINE push to salespersons"
```

---

### Task 4: Environment Variables + Smoke Test

**Files:**
- Modify: `.env.local`

This task documents the required env vars and verifies everything works end-to-end locally.

- [ ] **Step 1: Add env vars to `.env.local`**

Open `.env.local` and append:

```env
# LINE Messaging API (from LINE Developers Console → your channel → Messaging API tab)
LINE_CHANNEL_ACCESS_TOKEN=your-long-lived-channel-access-token-here
LINE_CHANNEL_SECRET=your-channel-secret-here

# Notify cron endpoint secret — random string, must match the URL used in cron-job.org
NOTIFY_SECRET=change-me-to-a-random-string
```

Leave placeholders in place until the LINE Developers channel is created. See the spec for one-time setup steps: `docs/superpowers/specs/2026-05-18-line-salesperson-notify-design.md`

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --reporter=verbose
```
Expected: All tests PASS (line-client, line-webhook, notify, plus existing customers/documents/products tests)

- [ ] **Step 3: Start dev server and smoke-test the endpoints**

```bash
npm run dev
```

In a second terminal, test that auth is working:

```bash
# Webhook: bad signature → 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:3000/api/line/webhook \
  -H "x-line-signature: invalid" \
  -H "content-type: application/json" \
  -d '{"events":[]}'
# Expected: 401

# Notify: wrong token → {"error":"Unauthorized"}
curl -s "http://localhost:3000/api/notify?token=wrong"
# Expected: {"error":"Unauthorized"}
```

- [ ] **Step 4: Final commit**

```bash
git add src/lib/line.ts src/app/api/line/webhook/route.ts src/app/api/notify/route.ts \
        src/__tests__/line-client.test.ts src/__tests__/line-webhook.test.ts src/__tests__/notify.test.ts
git commit -m "feat: LINE salesperson notification — webhook + notify routes + tests"
```

_(Only commit `.env.local` if it's tracked by git — it usually isn't.)_

---

## Self-Review

**1. Spec coverage:**
- ✅ `/api/line/webhook` with HMAC-SHA256 signature validation → Task 2
- ✅ `follow` event → reply asking for name → Task 2
- ✅ `message` event → case-insensitive name match → save `line_user_id` → reply success/fail → Task 2
- ✅ `/api/notify` protected by `NOTIFY_SECRET` query param → Task 3
- ✅ SQL query: GROUP BY customer/salesperson, HAVING ≥ 90 days, only salespersons with `line_user_id` → Task 3
- ✅ Push message per customer: `⚠️ [name] ไม่ได้ซื้อมา X วันแล้ว` → Task 3
- ✅ LINE API error for one customer → log, continue, record error → Task 3
- ✅ DB error → return 500 → Task 3
- ✅ Returns `{ sent, errors }` → Task 3
- ✅ Env vars: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `NOTIFY_SECRET` → Task 4
- ✅ No schema change (column already exists) → noted in File Map

**2. Placeholder scan:** None found. All code blocks are complete.

**3. Type consistency:**
- `verifySignature(rawBody: string, signature: string): boolean` — consistent Task 1 and Task 2
- `pushMessage(userId: string, text: string): Promise<void>` — consistent Task 1 and Task 3
- `replyMessage(replyToken: string, text: string): Promise<void>` — consistent Task 1 and Task 2
- `LapsedCustomer.days_since: number` — used with `Number()` conversion in message template (safe for BigInt edge case)
