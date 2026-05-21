# Customer Edit Form & Salesperson LINE Manage — Design

## Goal

Two independent features: (1) an edit form for customer data accessible from the customer detail page, and (2) a LINE management UI on the salesperson detail page supporting one-time-code linking and unlinking.

## Architecture

No new pages beyond the edit page. Customer edit uses a separate `/edit` route (server page + client form component). Salesperson LINE manage is a single client component on the existing detail page. Both features add new API routes. Feature 2 requires a schema migration (two new nullable fields on `salespersons`).

---

## Feature 1: Customer Edit Form

### Route

`src/app/crm/customers/[id]/edit/page.tsx` — server component, `export const dynamic = "force-dynamic"`.

Loads the customer by id (`notFound()` if missing) and all salespersons for the dropdown. Passes data as props to `CustomerEditForm`.

### Client Component

`src/app/crm/customers/CustomerEditForm.tsx` — `"use client"`.

Props: `{ customer: CustomerFields; salespersons: { id: number; name: string }[] }`.

Renders a form with the following fields:

| Field | Input type | Notes |
|-------|-----------|-------|
| ชื่อ (`name`) | text | required |
| TAX ID (`taxId`) | text | optional |
| จดทะเบียน VAT (`vatRegistered`) | checkbox | |
| ประเภท (`type`) | text | optional |
| สถานะ (`status`) | select | values: `not_purchase_yet`, `active`, `inactive` |
| จังหวัด (`province`) | text | optional |
| ที่อยู่ (`address`) | textarea | optional |
| โทรศัพท์ (`phone`) | text | optional |
| อีเมล (`email`) | text | optional |
| LINE ID (`lineId`) | text | optional |
| พนักงานขาย (`salespersonId`) | select | options from salespersons list + "ไม่ระบุ" (null) |

On submit: `PATCH /api/customers/[id]` with JSON body of all fields. On success: `router.push(`/crm/customers/${id}`)`. On error: show inline error message below the form (not `window.alert`). Loading state: submit button disabled + "กำลังบันทึก..." text.

### API Route

`src/app/api/customers/[id]/route.ts` — `PATCH` handler.

- Auth check via `auth()` — return 401 if no session
- Parse and validate `id` (integer, `String(id) !== rawId` guard) — return 400 if invalid
- Parse body — return 400 if `name` is empty string or missing
- `prisma.customer.update({ where: { id }, data: { ...fields } })`
- Catch `PrismaClientKnownRequestError` P2002 (unique constraint on `taxId`) → return 400 `{ error: "TAX ID ซ้ำกับลูกค้าอื่น" }`
- Catch P2025 (not found) → return 404
- Return `{ ok: true }`

`salespersonId` in body: accept `null` (unassign) or integer. Do not touch fields absent from the body — send all fields explicitly from the form.

### Integration

`src/app/crm/customers/[id]/page.tsx`: add "แก้ไข" button (link) in the info card header area, linking to `/crm/customers/${customer.id}/edit`.

---

## Feature 2: Salesperson LINE Manage

### Schema Change

Add two nullable fields to the `Salesperson` model in `prisma/schema.prisma`:

```prisma
linkCode          String?   @map("link_code")
linkCodeExpiresAt DateTime? @map("link_code_expires_at")
```

Run `prisma migrate dev` to generate and apply the migration.

### API Routes

**`POST /api/salespersons/[id]/line/code`**

- Auth check — 401 if no session
- Validate id — 400 if invalid
- Generate 6-character uppercase alphanumeric code (e.g. `AB3X9Z`)
- Compute `expiresAt = now + 15 minutes`
- `prisma.salesperson.update({ where: { id }, data: { linkCode: code, linkCodeExpiresAt: expiresAt } })`
- Catch P2025 → 404
- Return `{ code, expiresAt }`

**`DELETE /api/salespersons/[id]/line`**

- Auth check — 401 if no session
- Validate id — 400 if invalid
- `prisma.salesperson.update({ where: { id }, data: { lineUserId: null, linkCode: null, linkCodeExpiresAt: null } })`
- Catch P2025 → 404
- Return `{ ok: true }`

### LINE Webhook Update

`src/app/api/line/webhook/route.ts` — in the unregistered branch, before the name-check, add a code-check:

In the unregistered branch, replace the existing name-check block with:

```ts
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
  // existing name-check (unchanged)
  const salesperson = await prisma.salesperson.findFirst({
    where: { name: { equals: inputText, mode: "insensitive" } },
  })
  if (salesperson) {
    await prisma.salesperson.update({ where: { id: salesperson.id }, data: { lineUserId: userId } })
    await replyMessage(event.replyToken ?? "", "ลงทะเบียนสำเร็จ ✅")
  } else {
    await replyMessage(event.replyToken ?? "", "ไม่พบชื่อในระบบ กรุณาลองใหม่")
  }
}
```

`userId` is `event.source?.userId ?? ""` (already available in the existing handler scope). Code matching is case-sensitive — codes are generated uppercase; the UI instructs the salesperson to type exactly as shown.

### Client Component

`src/app/crm/salespersons/SalespersonLineManage.tsx` — `"use client"`.

Props: `{ salespersonId: number; lineUserId: string | null }`.

**If `lineUserId` is set:**
- Show green badge "✅ LINE ลงทะเบียนแล้ว"
- "ยกเลิก LINE" button → confirm `window.confirm("ยืนยันยกเลิกการเชื่อมต่อ LINE?")` → `DELETE` → `router.refresh()`

**If `lineUserId` is null:**
- Show gray badge "ยังไม่ลงทะเบียน LINE"
- "สร้าง Link Code" button → `POST /api/salespersons/[id]/line/code` → display code and instruction
- After POST success: show box with code (`font-mono text-2xl`) + text "ให้พนักงานพิมพ์ข้อความนี้ใน LINE ภายใน 15 นาที" + expiry time
- "ปิด" button to dismiss the code display (clears local state only — code remains valid in DB until used or expired)
- Loading state on both buttons during fetch

### Integration

`src/app/crm/salespersons/[id]/page.tsx`: replace the current static LINE badge in the header with `<SalespersonLineManage salespersonId={sp.id} lineUserId={sp.line_user_id} />`.

---

## Out of Scope

- Customer delete
- Salesperson name/channel edit
- Code expiry cleanup job (expired codes are simply ignored by the webhook check)
- Code display auto-refresh / polling for link success
