# LINE Customer Query & Enhanced Notifications — Design Spec

**Goal:** Enrich lapsed-customer push notifications with order stats, and let registered salespersons query customer details via LINE chat.

**Architecture:** Two changes to existing routes — `notify/route.ts` and `line/webhook/route.ts`. No new files. Prisma for all DB access.

---

## Feature 1: Enhanced Notification Message

**File:** `src/app/api/notify/route.ts`

Current SQL already groups by customer. Add to SELECT:
- `COUNT(d.id) AS order_count` — total tax invoices
- Last invoice total via subquery or window function

Message format (single text message per customer):
```
⚠️ {customer_name} ไม่ได้ซื้อมา {days_since} วันแล้ว
📦 ซื้อทั้งหมด {order_count} ครั้ง
💰 ยอดล่าสุด ฿{last_total}
```

`last_total` = `total` of the most recent invoice (by `doc_date`). Use a lateral join or subquery — already have `MAX(d.doc_date)` so can match on it.

---

## Feature 2: LINE Chat Customer Query

**File:** `src/app/api/line/webhook/route.ts`

### Registration vs. Query routing

When a `message` event arrives:
1. Look up salesperson by `event.source.userId` (lineUserId field)
2. **Not registered** → existing registration flow (find by name, update lineUserId)
3. **Registered** → treat message text as customer search query

### Customer search

Query: `WHERE name ILIKE '%{text}%' ORDER BY name LIMIT 10`

**No match:** Reply `"ไม่พบลูกค้า: {text}"`

**More than 3 matches:** Reply list of names, ask to narrow down:
```
พบ {n} รายการ กรุณาพิมพ์ชื่อให้แม่นยำขึ้น:
• บริษัท ABC จำกัด
• บริษัท ABCD จำกัด
...
```

**1–3 matches:** For each match, reply with full profile. If multiple matches, send one message per customer (separate `replyMessage` or combine into one text block).

### Customer detail format

```
👤 {name}
📍 {province} | {type}
🛒 ซื้อ {invoice_count} ครั้ง | ล่าสุด {last_date dd/mm/yyyy}
💰 ยอดรวม ฿{total_spend}

เอกสาร 5 รายการล่าสุด:
• {docNumber} | {date} | ฿{total} {status_icon}
• ...
```

`status_icon`: ✅ = paid, ⏳ = pending (tax invoices only; quotations show Q)

### Data query

Single Prisma query per matched customer:
```typescript
prisma.customer.findMany({
  where: { name: { contains: text, mode: "insensitive" } },
  take: 10,
  include: {
    documents: {
      orderBy: { docDate: "desc" },
      take: 5,
      select: { docNumber, docDate, docType, total, paymentStatus }
    },
    _count: { select: { documents: { where: { docType: "tax_invoice" } } } }
  }
})
```

`total_spend` = sum of all tax invoice totals — requires second query or aggregation. Use a separate `prisma.document.aggregate` call.

### Reply method

LINE reply token is single-use and expires quickly. For 1–3 customer results, combine all into one text message (newlines between customers). Do not call `replyMessage` multiple times.

---

## Constraints

- `replyMessage` can only be called once per event (reply token is single-use)
- LINE text message max 5000 chars — truncate document list if needed
- Registration flow is unchanged: if `lineUserId` not yet set, treat message as name input regardless of content
- No new files, no new DB tables

---

## Not in scope

- Pagination / "see more" interaction
- Filtering by doc type in chat
- Editing customer data via LINE
