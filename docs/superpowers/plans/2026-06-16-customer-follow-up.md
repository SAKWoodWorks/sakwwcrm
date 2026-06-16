# Customer Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Customer Follow-Up CRM module that lists customers with paid TAX invoices but no purchase in 30+ days.

**Architecture:** Add a locale-prefixed server page at `src/app/[locale]/crm/follow-up/page.tsx` that queries PostgreSQL with Prisma raw SQL for lapsed customers, bucket counts, salesperson options, and recent products. Add a small client filter component for bucket/salesperson query params using `@/i18n/navigation`. Add translations, nav entry, tests, and docs.

**Tech Stack:** Next.js App Router, Prisma raw SQL, next-intl, Vitest, existing CRM UI components.

---

### Task 1: Add Follow-Up Translations And Navigation

**Files:**
- Modify: `messages/th.json`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`
- Modify: `src/components/NavBar.tsx`

- [ ] Add `FollowUp` namespace to all message files with title, description, bucket labels, filters, table labels, empty state, and contact fallbacks.
- [ ] Add a nav item for `/crm/follow-up` using the `FollowUp.title` translation.

### Task 2: Add Follow-Up Page And Filters

**Files:**
- Create: `src/app/[locale]/crm/follow-up/page.tsx`
- Create: `src/app/[locale]/crm/follow-up/FollowUpFilters.tsx`

- [ ] Query customers whose last paid TAX invoice is 30+ days old.
- [ ] Bucket rows into `30_59`, `60_89`, `90_179`, and `180_plus`.
- [ ] Filter by bucket and salesperson.
- [ ] Render summary cards and a responsive table/list with customer, contact, salesperson, last paid invoice date, days since purchase, last total, total paid, and recent products.
- [ ] Link customer names to customer detail pages.

### Task 3: Add Tests

**Files:**
- Create: `src/__tests__/follow-up-page.test.tsx`

- [ ] Mock Prisma, next-intl, and locale navigation.
- [ ] Assert the page renders translated heading, bucket summary, customer rows, recent products, and customer links.
- [ ] Assert filters pass selected query params into the rendered controls.

### Task 4: Documentation And Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `Project.md`

- [ ] Document `/crm/follow-up` as a migrated TH/EN/RU module.
- [ ] Run `npx vitest run src/__tests__/follow-up-page.test.tsx`.
- [ ] Run `npm run lint`.
