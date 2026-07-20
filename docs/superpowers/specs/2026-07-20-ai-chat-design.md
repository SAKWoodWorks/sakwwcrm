# CRM AI Chat Design

**Date:** 2026-07-20  
**Status:** Approved

## Problem

Salespeople need to query CRM data quickly in natural language (Thai, English, or Russian) without navigating to specific pages.

## Solution

Floating chat bubble (bottom-right, all CRM pages) backed by Google Gemini 1.5 Flash (free tier). User types a question in any language; Gemini picks one or more predefined query tools; server executes Prisma queries; Gemini formats the answer in the same language the user typed.

## Environment

New env var: `GEMINI_API_KEY` — get free at aistudio.google.com  
New package: `@google/generative-ai`

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/gemini.ts` | Gemini client singleton + 7 tool definitions + tool executor |
| Create | `src/app/api/ai/chat/route.ts` | POST endpoint — orchestrates Gemini ↔ tool execution |
| Create | `src/app/[locale]/crm/ChatBubble.tsx` | Floating UI, client component |
| Modify | `src/app/[locale]/layout.tsx` | Add `<ChatBubble />` before `</NextIntlClientProvider>` |

## Query Tools (7)

All tools are safe Prisma reads — no writes, no raw SQL injection risk.

### 1. `get_dashboard_stats`
No parameters. Returns: total customers, active deals count, this month's revenue (THB), lapsed customer count (no purchase >90 days).

### 2. `get_top_customers`
Parameters: `limit` (int, default 5), `month` (int 1-12, optional), `year` (int, optional).  
Returns: ranked list of customers by revenue with name and total (THB).

### 3. `get_customer_info`
Parameters: `name` (string — substring search).  
Returns: customer name, province, status, order count, last purchase date, lifetime revenue.

### 4. `get_deal_pipeline`
No parameters. Returns: deal count and total value grouped by stage, plus weighted forecast.

### 5. `get_monthly_revenue`
Parameters: `year` (int, default current year).  
Returns: revenue per month for the given year (THB).

### 6. `get_lapsed_customers`
Parameters: `days` (int, default 90), `limit` (int, default 10).  
Returns: customers who have not purchased in `days` days, with last purchase date.

### 7. `get_top_products`
Parameters: `limit` (int, default 5), `month` (int 1-12, optional), `year` (int, optional).  
Returns: top products by revenue with name, SKU, and total sold (THB).

## API Route: POST /api/ai/chat

Request body:
```json
{ "message": "string", "history": [{ "role": "user|model", "parts": [{ "text": "string" }] }] }
```

Response:
```json
{ "reply": "string" }
```

Flow:
1. Validate: message must be non-empty string
2. Initialize Gemini with system instruction (respond in same language as user, be concise, format numbers with commas, use THB for currency)
3. Send message + history + tool definitions to Gemini
4. If Gemini returns a tool call: execute the matching Prisma query, send result back to Gemini, get final text reply
5. Return `{ reply }` — never expose raw DB errors to client

Error handling:
- Missing `GEMINI_API_KEY` → 503 `{ error: "AI not configured" }`
- Gemini API error → 500 `{ error: "AI unavailable" }`
- Tool execution error → pass `{ error: "query failed" }` back to Gemini (it will handle gracefully)

## UI: ChatBubble Component

`"use client"`, added to `src/app/[locale]/layout.tsx` inside `<NextIntlClientProvider>`.

**Collapsed state:** Round button fixed `bottom-6 right-6 z-50`, brand color (`var(--crm-brand)`), message icon.

**Expanded state:** Card panel `w-80 h-[480px]` above the bubble with:
- Header: "CRM Assistant" + X close button
- Message list (scrollable, flex-col, newest at bottom)
- User messages: right-aligned, brand background
- AI messages: left-aligned, gray background
- Loading indicator: animated dots while waiting
- Input row: text input + send button (disabled while loading)

State: `open`, `messages: { role, text }[]`, `loading`, `input`

On send:
1. Append user message to `messages`
2. Set `loading = true`
3. POST `/api/ai/chat` with `{ message: input, history }` — history built from `messages` in Gemini format
4. Append AI reply to `messages`
5. Set `loading = false`

On error: append error message in gray italic text (no crash).

## Gemini System Instruction

```
You are a CRM assistant for a Thai timber and wood-products company. Answer questions about customers, sales, deals, and products using the provided tools. Always respond in the same language the user writes in (Thai, English, or Russian). Be concise. Format currency as Thai Baht with commas (e.g. ฿1,234,567). Format dates as DD/MM/YYYY. Never make up data — only report what the tools return.
```

## Out of Scope

- Writing/mutating data (create deal, update customer) — read-only only
- Conversation memory across page refreshes — history resets on reload
- Auth on the chat endpoint — inherits same session as the rest of the CRM (auth-bypassed in dev)
- Rate limiting — Gemini free tier handles 1500 req/day; sufficient for internal tool
