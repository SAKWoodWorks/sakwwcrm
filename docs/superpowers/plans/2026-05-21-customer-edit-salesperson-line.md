# Customer Edit Form & Salesperson LINE Manage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer edit form at `/crm/customers/[id]/edit` and a LINE link/unlink UI on the salesperson detail page using one-time codes.

**Architecture:** Customer edit — new PATCH API route + "use client" form component + server edit page. Salesperson LINE — schema migration adds two fields, two new API routes (DELETE unlink + POST generate code), a "use client" component replaces the static badge on the detail page, and the LINE webhook gains a code-check before the existing name-check. No new pages beyond the customer edit page.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM, PostgreSQL, Vitest, Tailwind CSS

---

## File Map

**Create:**
- `src/app/api/customers/[id]/route.ts` — PATCH handler for customer update
- `src/app/crm/customers/CustomerEditForm.tsx` — "use client" form component
- `src/app/crm/customers/[id]/edit/page.tsx` — server page: load data, render form
- `src/app/api/salespersons/[id]/line/route.ts` — DELETE handler to unlink LINE
- `src/app/api/salespersons/[id]/line/code/route.ts` — POST handler to generate link code
- `src/app/crm/salespersons/SalespersonLineManage.tsx` — "use client" LINE manage component
- `src/__tests__/customer-edit.test.ts` — tests for PATCH /api/customers/[id]
- `src/__tests__/salesperson-line.test.ts` — tests for DELETE/POST salesperson LINE routes

**Modify:**
- `prisma/schema.prisma` — add `linkCode` and `linkCodeExpiresAt` to Salesperson model
- `src/app/crm/customers/[id]/page.tsx` — add "แก้ไข" button; fix `parseInt` radix
- `src/app/crm/salespersons/[id]/page.tsx` — replace static LINE badge with SalespersonLineManage
- `src/app/api/line/webhook/route.ts` — add code-check before name-check in unregistered branch
- `src/__tests__/line-webhook.test.ts` — update existing mock chains + add code-check test

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Salesperson model**

In `prisma/schema.prisma`, inside the `model Salesperson { ... }` block, add these two lines after the `active` field:

```prisma
  linkCode          String?   @map("link_code")
  linkCodeExpiresAt DateTime? @map("link_code_expires_at")
```

The full model should look like:

```prisma
model Salesperson {
  id                Int        @id @default(autoincrement())
  name              String
  channel           String?
  lineUserId        String?    @map("line_user_id")
  active            Boolean    @default(true)
  linkCode          String?    @map("link_code")
  linkCodeExpiresAt DateTime?  @map("link_code_expires_at")
  createdAt         DateTime   @default(now()) @map("created_at")

  documents        Document[]
  managedCustomers Customer[] @relation("AccountManager")

  @@map("salespersons")
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `add_salesperson_link_code`

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npm run db:generate
```

Expected: client generated without errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add link_code and link_code_expires_at to salespersons"
```

---

## Task 2: Customer PATCH API + Tests

**Files:**
- Create: `src/__tests__/customer-edit.test.ts`
- Create: `src/app/api/customers/[id]/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/customer-edit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { PATCH } from "@/app/api/customers/[id]/route"

const validBody = {
  name: "บริษัท ABC จำกัด",
  taxId: "1234567890123",
  vatRegistered: true,
  type: "dealer",
  status: "active",
  province: "กรุงเทพ",
  address: "123 ถนนสุขุมวิท",
  phone: "021234567",
  email: "abc@example.com",
  lineId: "@abcco",
  salespersonId: null,
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const res = await PATCH(makeReq(validBody), makeParams("1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const res = await PATCH(makeReq(validBody), makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id like '1abc'", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const res = await PATCH(makeReq(validBody), makeParams("1abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when name is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const { name: _, ...noName } = validBody
    const res = await PATCH(makeReq(noName), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("returns 400 when name is blank whitespace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const res = await PATCH(makeReq({ ...validBody, name: "   " }), makeParams("1"))
    expect(res.status).toBe(400)
  })

  it("returns 200 and ok:true on success", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.customer.update).mockResolvedValue({} as any)
    const res = await PATCH(makeReq(validBody), makeParams("5"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("calls prisma.customer.update with correct id and trimmed name", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.customer.update).mockResolvedValue({} as any)
    await PATCH(makeReq({ ...validBody, name: "  บริษัท XYZ  " }), makeParams("7"))
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ name: "บริษัท XYZ" }),
      })
    )
  })

  it("returns 400 on P2002 duplicate taxId", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const err = Object.assign(
      new Error("Unique constraint"),
      { code: "P2002", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.customer.update).mockRejectedValue(err)
    const res = await PATCH(makeReq(validBody), makeParams("1"))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain("TAX ID")
  })

  it("returns 404 on P2025 not found", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const err = Object.assign(
      new Error("Record not found"),
      { code: "P2025", clientVersion: "0.0.0" }
    )
    Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
    vi.mocked(prisma.customer.update).mockRejectedValue(err)
    const res = await PATCH(makeReq(validBody), makeParams("99"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/customer-edit.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/customers/[id]/route'"

- [ ] **Step 3: Create the PATCH route**

Create `src/app/api/customers/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const custId = parseInt(id, 10)
  if (isNaN(custId) || String(custId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== "string" || !body.name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 })

  const data = {
    name: (body.name as string).trim(),
    taxId: (body.taxId as string) || null,
    vatRegistered: Boolean(body.vatRegistered),
    type: (body.type as string) || null,
    status: (body.status as string) || "not_purchase_yet",
    province: (body.province as string) || null,
    address: (body.address as string) || null,
    phone: (body.phone as string) || null,
    email: (body.email as string) || null,
    lineId: (body.lineId as string) || null,
    salespersonId: body.salespersonId ? Number(body.salespersonId) : null,
  }

  try {
    await prisma.customer.update({ where: { id: custId }, data })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return NextResponse.json({ error: "TAX ID ซ้ำกับลูกค้าอื่น" }, { status: 400 })
      if (err.code === "P2025")
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/customer-edit.test.ts
```

Expected: 9/9 PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/customer-edit.test.ts src/app/api/customers/
git commit -m "feat: PATCH /api/customers/[id] route with auth and validation"
```

---

## Task 3: Customer Edit UI

**Files:**
- Create: `src/app/crm/customers/CustomerEditForm.tsx`
- Create: `src/app/crm/customers/[id]/edit/page.tsx`
- Modify: `src/app/crm/customers/[id]/page.tsx`

No automated tests for UI components — verify manually in browser.

- [ ] **Step 1: Create CustomerEditForm client component**

Create `src/app/crm/customers/CustomerEditForm.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface CustomerData {
  id: number
  name: string
  taxId: string | null
  vatRegistered: boolean
  type: string | null
  status: string
  province: string | null
  address: string | null
  phone: string | null
  email: string | null
  lineId: string | null
  salespersonId: number | null
}

interface Props {
  customer: CustomerData
  salespersons: { id: number; name: string }[]
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function CustomerEditForm({ customer, salespersons }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const data = new FormData(form)

    const body = {
      name: data.get("name") as string,
      taxId: (data.get("taxId") as string) || null,
      vatRegistered: data.get("vatRegistered") === "on",
      type: (data.get("type") as string) || null,
      status: data.get("status") as string,
      province: (data.get("province") as string) || null,
      address: (data.get("address") as string) || null,
      phone: (data.get("phone") as string) || null,
      email: (data.get("email") as string) || null,
      lineId: (data.get("lineId") as string) || null,
      salespersonId: data.get("salespersonId") ? Number(data.get("salespersonId")) : null,
    }

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่")
        return
      }
      router.push(`/crm/customers/${customer.id}`)
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ *</label>
        <input name="name" type="text" defaultValue={customer.name} required className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">TAX ID</label>
        <input name="taxId" type="text" defaultValue={customer.taxId ?? ""} className={inputCls} />
      </div>

      <div className="flex items-center gap-2">
        <input
          name="vatRegistered"
          type="checkbox"
          id="vatRegistered"
          defaultChecked={customer.vatRegistered}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="vatRegistered" className="text-sm font-medium text-gray-700">
          จดทะเบียน VAT
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ประเภท</label>
        <input name="type" type="text" defaultValue={customer.type ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
        <select name="status" defaultValue={customer.status} className={inputCls}>
          <option value="not_purchase_yet">ยังไม่ซื้อ</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">จังหวัด</label>
        <input name="province" type="text" defaultValue={customer.province ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">ที่อยู่</label>
        <textarea
          name="address"
          defaultValue={customer.address ?? ""}
          rows={3}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">โทรศัพท์</label>
        <input name="phone" type="text" defaultValue={customer.phone ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล</label>
        <input name="email" type="email" defaultValue={customer.email ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">LINE ID</label>
        <input name="lineId" type="text" defaultValue={customer.lineId ?? ""} className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">พนักงานขาย</label>
        <select name="salespersonId" defaultValue={customer.salespersonId ?? ""} className={inputCls}>
          <option value="">ไม่ระบุ</option>
          {salespersons.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <a
          href={`/crm/customers/${customer.id}`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ยกเลิก
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create customer edit page**

Create `src/app/crm/customers/[id]/edit/page.tsx`:

```tsx
export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import CustomerEditForm from "../../CustomerEditForm"

type Props = { params: Promise<{ id: string }> }

export default async function CustomerEditPage({ params }: Props) {
  const { id } = await params
  const custId = parseInt(id, 10)
  if (isNaN(custId)) notFound()

  const [customer, salespersons] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: custId },
      select: {
        id: true,
        name: true,
        taxId: true,
        vatRegistered: true,
        type: true,
        status: true,
        province: true,
        address: true,
        phone: true,
        email: true,
        lineId: true,
        salespersonId: true,
      },
    }),
    prisma.salesperson.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!customer) notFound()

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4">
        <Link href={`/crm/customers/${custId}`} className="text-sm text-blue-600 hover:underline">
          ← {customer.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">แก้ไขข้อมูลลูกค้า</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CustomerEditForm customer={customer} salespersons={salespersons} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add "แก้ไข" button to customer detail page**

In `src/app/crm/customers/[id]/page.tsx`:

1. Fix `parseInt(id)` → `parseInt(id, 10)` on line 13.

2. Replace the existing `<h1>` inside the info card:
```tsx
<h1 className="mb-4 text-2xl font-semibold">{customer.name}</h1>
```
with:
```tsx
<div className="mb-4 flex items-center justify-between">
  <h1 className="text-2xl font-semibold">{customer.name}</h1>
  <Link
    href={`/crm/customers/${customer.id}/edit`}
    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
  >
    แก้ไข
  </Link>
</div>
```

`Link` is already imported at the top of the file.

- [ ] **Step 4: Verify in browser**

Start dev server: `npm run dev`

Navigate to any customer detail page (e.g. `/crm/customers/1`). Verify:
- "แก้ไข" button appears in the top-right of the info card
- Clicking navigates to `/crm/customers/1/edit`
- All fields pre-populated with current values
- Saving redirects back to detail page with updated data
- Leaving name blank shows 400 error inline (not alert)
- Cancelling returns to detail page

- [ ] **Step 5: Commit**

```bash
git add src/app/crm/customers/
git commit -m "feat: customer edit form at /crm/customers/[id]/edit"
```

---

## Task 4: Salesperson LINE API Routes + Tests

**Files:**
- Create: `src/__tests__/salesperson-line.test.ts`
- Create: `src/app/api/salespersons/[id]/line/route.ts`
- Create: `src/app/api/salespersons/[id]/line/code/route.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/salesperson-line.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: { update: vi.fn() },
  },
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { DELETE } from "@/app/api/salespersons/[id]/line/route"
import { POST } from "@/app/api/salespersons/[id]/line/code/route"

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeP2025() {
  const err = Object.assign(new Error("Not found"), { code: "P2025", clientVersion: "0.0.0" })
  Object.setPrototypeOf(err, Prisma.PrismaClientKnownRequestError.prototype)
  return err
}

describe("DELETE /api/salespersons/[id]/line", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/salespersons/5/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const req = new NextRequest("http://localhost/api/salespersons/abc/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 400 for garbage-prefixed id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const req = new NextRequest("http://localhost/api/salespersons/5abc/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5abc"))
    expect(res.status).toBe(400)
  })

  it("clears lineUserId, linkCode, linkCodeExpiresAt and returns ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.salesperson.update).mockResolvedValue({} as any)
    const req = new NextRequest("http://localhost/api/salespersons/5/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("5"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(prisma.salesperson.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { lineUserId: null, linkCode: null, linkCodeExpiresAt: null },
    })
  })

  it("returns 404 on P2025", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.salesperson.update).mockRejectedValue(makeP2025())
    const req = new NextRequest("http://localhost/api/salespersons/99/line", { method: "DELETE" })
    const res = await DELETE(req, makeParams("99"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/salespersons/[id]/line/code", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    const res = await POST(req, makeParams("5"))
    expect(res.status).toBe(401)
  })

  it("returns 400 for non-numeric id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    const req = new NextRequest("http://localhost/api/salespersons/abc/line/code", { method: "POST" })
    const res = await POST(req, makeParams("abc"))
    expect(res.status).toBe(400)
  })

  it("returns 200 with 6-char code and expiresAt", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.salesperson.update).mockResolvedValue({} as any)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    const before = Date.now()
    const res = await POST(req, makeParams("5"))
    const after = Date.now()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(typeof json.code).toBe("string")
    expect(json.code).toHaveLength(6)
    expect(json.code).toMatch(/^[A-Z2-9]{6}$/)
    const expiresMs = new Date(json.expiresAt).getTime()
    expect(expiresMs).toBeGreaterThan(before + 14 * 60 * 1000)
    expect(expiresMs).toBeLessThan(after + 16 * 60 * 1000)
  })

  it("saves code and expiresAt to DB", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.salesperson.update).mockResolvedValue({} as any)
    const req = new NextRequest("http://localhost/api/salespersons/5/line/code", { method: "POST" })
    await POST(req, makeParams("5"))
    expect(prisma.salesperson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({
          linkCode: expect.stringMatching(/^[A-Z2-9]{6}$/),
          linkCodeExpiresAt: expect.any(Date),
        }),
      })
    )
  })

  it("returns 404 on P2025", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as any)
    vi.mocked(prisma.salesperson.update).mockRejectedValue(makeP2025())
    const req = new NextRequest("http://localhost/api/salespersons/99/line/code", { method: "POST" })
    const res = await POST(req, makeParams("99"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/salesperson-line.test.ts
```

Expected: FAIL — "Cannot find module '@/app/api/salespersons/[id]/line/route'"

- [ ] **Step 3: Create DELETE route**

Create `src/app/api/salespersons/[id]/line/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const spId = parseInt(id, 10)
  if (isNaN(spId) || String(spId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  try {
    await prisma.salesperson.update({
      where: { id: spId },
      data: { lineUserId: null, linkCode: null, linkCodeExpiresAt: null },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create POST code route**

Create `src/app/api/salespersons/[id]/line/code/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const spId = parseInt(id, 10)
  if (isNaN(spId) || String(spId) !== id)
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const code = generateCode()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  try {
    await prisma.salesperson.update({
      where: { id: spId },
      data: { linkCode: code, linkCodeExpiresAt: expiresAt },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ code, expiresAt })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/salesperson-line.test.ts
```

Expected: 9/9 PASS

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/salesperson-line.test.ts src/app/api/salespersons/
git commit -m "feat: DELETE/POST salesperson LINE routes for unlink and code generation"
```

---

## Task 5: SalespersonLineManage Component

**Files:**
- Create: `src/app/crm/salespersons/SalespersonLineManage.tsx`
- Modify: `src/app/crm/salespersons/[id]/page.tsx`

No automated tests — verify in browser.

- [ ] **Step 1: Create SalespersonLineManage component**

Create `src/app/crm/salespersons/SalespersonLineManage.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  salespersonId: number
  lineUserId: string | null
}

export default function SalespersonLineManage({ salespersonId, lineUserId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [codeInfo, setCodeInfo] = useState<{ code: string; expiresAt: string } | null>(null)

  async function handleUnlink() {
    if (!confirm("ยืนยันยกเลิกการเชื่อมต่อ LINE?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/salespersons/${salespersonId}/line`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      router.refresh()
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
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
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setLoading(false)
    }
  }

  if (lineUserId) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          ✅ LINE ลงทะเบียนแล้ว
        </span>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {loading ? "..." : "ยกเลิก LINE"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          ยังไม่ลงทะเบียน LINE
        </span>
        {!codeInfo && (
          <button
            onClick={handleGenerateCode}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {loading ? "..." : "สร้าง Link Code"}
          </button>
        )}
      </div>
      {codeInfo && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="mb-1 text-gray-600">ให้พนักงานพิมพ์ข้อความนี้ใน LINE ภายใน 15 นาที:</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-blue-700">{codeInfo.code}</p>
          <p className="mt-1 text-xs text-gray-400">
            หมดอายุ: {new Date(codeInfo.expiresAt).toLocaleTimeString("th-TH")}
          </p>
          <button onClick={() => setCodeInfo(null)} className="mt-2 text-xs text-gray-500 hover:underline">
            ปิด
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into salesperson detail page**

In `src/app/crm/salespersons/[id]/page.tsx`:

Add import after existing imports:
```tsx
import SalespersonLineManage from "../SalespersonLineManage"
```

Replace the existing static LINE badge block in the header section (lines that render the green/gray badge based on `sp.line_user_id`):

```tsx
{sp.line_user_id ? (
  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
    ✅ LINE ลงทะเบียนแล้ว
  </span>
) : (
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
    ยังไม่ลงทะเบียน LINE
  </span>
)}
```

with:

```tsx
<SalespersonLineManage salespersonId={sp.id} lineUserId={sp.line_user_id} />
```

- [ ] **Step 3: Verify in browser**

Navigate to any salesperson detail page (e.g. `/crm/salespersons/1`).

If salesperson **is** linked to LINE:
- Verify green badge "✅ LINE ลงทะเบียนแล้ว" + "ยกเลิก LINE" button appear
- Click "ยกเลิก LINE" → confirm dialog appears → confirm → badge changes to gray

If salesperson **is not** linked:
- Verify gray badge + "สร้าง Link Code" button
- Click "สร้าง Link Code" → code box appears with 6-char code and expiry time
- "ปิด" button dismisses the box

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/salespersons/
git commit -m "feat: SalespersonLineManage component with link code and unlink"
```

---

## Task 6: LINE Webhook Code-Check + Test Updates

**Files:**
- Modify: `src/app/api/line/webhook/route.ts`
- Modify: `src/__tests__/line-webhook.test.ts`

- [ ] **Step 1: Update webhook tests first**

In `src/__tests__/line-webhook.test.ts`, make three changes:

**Change 1** — "saves line_user_id and replies success when name matches" — add one extra null mock for the code-check:

```ts
it("saves line_user_id and replies success when name matches", async () => {
  ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(null)                          // lineUserId check → not registered
    .mockResolvedValueOnce(null)                          // linkCode check → no match
    .mockResolvedValueOnce({ id: 5, name: "Pickachu" })   // name check → found
  ;(prisma.salesperson.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
  // ... rest of test unchanged
```

**Change 2** — "replies not-found when name does not match" — add one extra null mock:

```ts
it("replies not-found when name does not match", async () => {
  ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(null)   // lineUserId check
    .mockResolvedValueOnce(null)   // code check
    .mockResolvedValueOnce(null)   // name check
  // ... rest of test unchanged
```

**Change 3** — add new test case for code-check path (add inside the `describe("POST /api/line/webhook")` block, before the `describe("customer search...")` nested block):

```ts
it("links via code when valid code is sent", async () => {
  ;(prisma.salesperson.findFirst as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(null)                       // lineUserId check → not registered
    .mockResolvedValueOnce({ id: 7, name: "Test SP" }) // linkCode check → match
  ;(prisma.salesperson.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

  const req = makeRequest({
    events: [
      {
        type: "message",
        replyToken: "reply-token-code",
        source: { userId: "Uxyz789" },
        message: { type: "text", text: "AB3X9Z" },
      },
    ],
  })
  const res = await POST(req)
  expect(res.status).toBe(200)
  expect(prisma.salesperson.update).toHaveBeenCalledWith({
    where: { id: 7 },
    data: { lineUserId: "Uxyz789", linkCode: null, linkCodeExpiresAt: null },
  })
  expect(replyMessage).toHaveBeenCalledWith("reply-token-code", "ลงทะเบียนสำเร็จ ✅")
})
```

- [ ] **Step 2: Run webhook tests to verify new test fails, existing pass**

```bash
npx vitest run src/__tests__/line-webhook.test.ts
```

Expected: the new "links via code" test FAILs; all others PASS.

- [ ] **Step 3: Update the webhook to add code-check**

In `src/app/api/line/webhook/route.ts`, replace the `else` block (the unregistered branch) starting from `} else {` down to the closing `}` of that block:

Current code to replace:
```ts
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
```

Replace with:
```ts
        } else {
          const codeMatch = await prisma.salesperson.findFirst({
            where: { linkCode: inputText, linkCodeExpiresAt: { gt: new Date() } },
          })
          if (codeMatch) {
            await prisma.salesperson.update({
              where: { id: codeMatch.id },
              data: { lineUserId: userId, linkCode: null, linkCodeExpiresAt: null },
            })
            await replyMessage(event.replyToken ?? "", "ลงทะเบียนสำเร็จ ✅")
          } else {
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
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS (including the new "links via code" test).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/line/webhook/route.ts src/__tests__/line-webhook.test.ts
git commit -m "feat: LINE webhook checks link code before name registration"
```

---

## Final Check

Run the full test suite one last time:

```bash
npm test
```

Expected: all tests pass. Then push:

```bash
git push origin master
```
