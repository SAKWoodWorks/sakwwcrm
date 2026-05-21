# CRM Dashboard, Navigation, Search & Sort Design

## Goal

Add a dashboard page with KPI metrics, improve navigation with active states, and add search/filter/sort to customers and documents pages.

## Architecture

Three independent UI improvements: (1) a shared `NavBar` client component, (2) a new `/crm/dashboard` server page with raw SQL stats, (3) enhanced search params on customers and documents pages. No new API routes. All data fetching stays server-side.

## Tech Stack

Next.js App Router, Tailwind CSS, Prisma `$queryRaw`, `usePathname` (client component for nav active state)

---

## 1. Navigation

**File:** `src/app/layout.tsx` + new `src/components/NavBar.tsx`

Extract nav into a `"use client"` component so it can call `usePathname()` to highlight the active link. Links: Dashboard, ลูกค้า, เอกสาร, สินค้า, พนักงาน.

Active link style: `text-blue-600 font-semibold` (vs default `text-gray-600`).

`/crm` redirects to `/crm/dashboard` (already done in `src/app/crm/page.tsx`).

## 2. Dashboard

**File:** `src/app/crm/dashboard/page.tsx`

Four KPI stat cards in a 2×2 grid (or 4-column row on wide screens). All data from one `$queryRaw` query returning all four metrics.

| Card | Query | Link |
|------|-------|------|
| ลูกค้าทั้งหมด | `COUNT(*) FROM customers` | `/crm/customers` |
| ยอดขายเดือนนี้ | `SUM(total) FROM documents WHERE doc_type='tax_invoice' AND doc_date >= date_trunc('month', CURRENT_DATE)` | — |
| Invoice เดือนนี้ | `COUNT(*) FROM documents WHERE doc_type='tax_invoice' AND doc_date >= date_trunc('month', CURRENT_DATE)` | `/crm/documents?type=tax_invoice` |
| Lapsed >90 วัน | customers with no tax_invoice in last 90 days (subquery matching salespersons page logic) | `/crm/customers?lapsed=1` |

Cards show number large, label small, red border for Lapsed card.

`export const dynamic = "force-dynamic"` required.

## 3. Customers Page — Sort

**File:** `src/app/crm/customers/page.tsx`

Add `sort` and `order` search params. Default: `sort=last_purchase&order=desc`.

| sort value | orderBy |
|------------|---------|
| `last_purchase` | last tax_invoice docDate desc/asc |
| `name` | customer name |
| `last_total` | last tax_invoice total |

Column headers for ชื่อ, ซื้อล่าสุด, ยอดล่าสุด become clickable links that toggle `order=asc/desc`. Current sort column shows ↑ or ↓ indicator.

Since Prisma `orderBy` on a relation's field requires `_max` aggregation or raw SQL, use `$queryRaw` for the customers list (consistent with salespersons page pattern).

Existing `q` search and pagination remain unchanged.

## 4. Documents Page — Filter + Sort

**File:** `src/app/crm/documents/page.tsx`

Add search params: `q` (customer name), `type` (doc_type), `status` (payment_status), `sort`, `order`.

**Filter bar** (above table): text input for customer name, `<select>` for doc_type (ทั้งหมด / tax_invoice / quotation / abb_invoice), `<select>` for payment_status (ทั้งหมด / paid / pending).

Filters are applied via Prisma `where` clauses. All filter inputs are client components that push to URL.

**Sort:** วันที่ (docDate) default desc, ยอด (total). Column headers clickable, same pattern as customers.

Pagination preserved.

## Out of Scope

- Charts or graphs on dashboard
- Inline editing
- Export to Excel
- lapsed=1 filter on customers page (dashboard links there but filter not implemented — just shows all customers for now until separate task)
