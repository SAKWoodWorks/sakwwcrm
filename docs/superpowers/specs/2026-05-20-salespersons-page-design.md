# Salespersons Page — Design Spec

**Date:** 2026-05-20
**Goal:** Add `/crm/salespersons` page showing active salespersons with LINE registration status, customer count, total revenue, and lapsed customer count.

---

## Scope

Two files modified, one created:

```
src/
├── app/
│   ├── layout.tsx                        MODIFY — add nav link
│   └── crm/
│       └── salespersons/
│           └── page.tsx                  CREATE — server component
```

---

## Data

Single Prisma query fetching salespersons where `_count(customers) > 0`. For each salesperson:

| Field | Source |
|-------|--------|
| name | `salesperson.name` |
| lineUserId | `salesperson.lineUserId` (null = not registered) |
| customerCount | `_count: { customers: true }` |
| totalRevenue | raw SQL subquery: `SUM(documents.total)` WHERE doc_type = tax_invoice |
| lapsedCount | raw SQL subquery: customers whose last tax_invoice > 90 days ago |

Because Prisma aggregates can't do cross-relation subqueries in one call, use `$queryRaw` for the full query with `LEFT JOIN` to documents.

**Sort order:** LINE registered first → totalRevenue DESC.

---

## Query (raw SQL)

```sql
SELECT
  s.id,
  s.name,
  s.line_user_id,
  COUNT(DISTINCT c.id)                                      AS customer_count,
  COALESCE(SUM(d.total) FILTER (WHERE d.doc_type = 'tax_invoice'), 0) AS total_revenue,
  COUNT(DISTINCT c.id) FILTER (
    WHERE d.doc_type = 'tax_invoice'
      AND NOT EXISTS (
        SELECT 1 FROM documents d2
        WHERE d2.customer_id = c.id
          AND d2.doc_type = 'tax_invoice'
          AND d2.doc_date >= CURRENT_DATE - INTERVAL '90 days'
      )
      AND EXISTS (
        SELECT 1 FROM documents d3
        WHERE d3.customer_id = c.id
          AND d3.doc_type = 'tax_invoice'
      )
  )                                                         AS lapsed_count
FROM salespersons s
JOIN customers c ON c.salesperson_id = s.id
LEFT JOIN documents d ON d.customer_id = c.id
GROUP BY s.id, s.name, s.line_user_id
ORDER BY
  (s.line_user_id IS NOT NULL) DESC,
  total_revenue DESC
```

---

## UI

Table — same style as `/crm/customers` (bordered, `divide-y`, `hover:bg-gray-50`, Tailwind v4).

Columns:
- **ชื่อ** — salesperson name
- **LINE** — green badge "✅ ลงทะเบียนแล้ว" or gray "—"
- **ลูกค้า** — customer_count (number)
- **ยอดรวม** — total_revenue formatted `฿X,XXX,XXX`
- **lapsed >90 วัน** — lapsed_count, red text if > 0, gray "—" if 0

No pagination (max ~30 real salespersons after filter). No search.

---

## Nav

Add link to `src/app/layout.tsx`:
```tsx
<Link href="/crm/salespersons" ...>พนักงาน</Link>
```

After existing "สินค้า" link.

---

## Type safety

`$queryRaw` returns `BigInt` for COUNT columns and `Prisma.Decimal` for SUM. Wrap all with `Number()` before formatting.

---

## Out of scope

- Editing salesperson details
- Manually linking LINE user ID via UI
- Pagination or search
