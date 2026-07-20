# Deal Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-pass Deal/Opportunity Pipeline so sales work can be tracked before it becomes an invoice.

**Architecture:** Add a Prisma `Deal` model linked to customers and salespersons, then expose a server-rendered list page, detail page, and a small authenticated API route for changing stage. Keep the first pass table-based to match existing CRM pages and leave Kanban/activity tracking for later.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Vitest.

---

### Task 1: Stage Update API

**Files:**
- Create: `src/__tests__/deal-stage.test.ts`
- Create: `src/app/api/deals/[id]/stage/route.ts`

- [ ] Write tests for authentication, numeric id validation, stage validation, successful update, and Prisma not-found handling.
- [ ] Run `npx vitest run src/__tests__/deal-stage.test.ts` and verify the route import fails before implementation.
- [ ] Implement `PATCH /api/deals/[id]/stage` using `auth()`, exact numeric id validation, and an allowlist of deal stages.
- [ ] Run the test file again and verify it passes.

### Task 2: Database Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260523000000_add_deals/migration.sql`

- [ ] Add `Deal` model and relations from `Customer` and `Salesperson`.
- [ ] Add SQL migration for the `deals` table and indexes on stage, customer, salesperson, and expected close date.
- [ ] Run `npx prisma generate`.

### Task 3: CRM Pages

**Files:**
- Modify: `src/components/NavBar.tsx`
- Create: `src/app/crm/deals/page.tsx`
- Create: `src/app/crm/deals/[id]/page.tsx`
- Create: `src/app/crm/deals/DealStageSelect.tsx`

- [ ] Add Deals to the CRM nav.
- [ ] Add `/crm/deals` with filters, pipeline total, weighted forecast, and paginated table.
- [ ] Add `/crm/deals/[id]` with linked customer and salesperson details.
- [ ] Add a client stage selector that calls the stage API and refreshes server components.

### Task 4: Verification

- [ ] Run `npx vitest run src/__tests__/deal-stage.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Report any verification commands that cannot run in this environment.
