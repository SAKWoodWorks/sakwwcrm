# Customer Combobox for Deal Create Form

**Date:** 2026-07-20  
**Status:** Approved

## Problem

The deal create form loads up to 300 customers into a plain `<Select>` dropdown. With many customers, users must scroll a long unfiltered list to find the right one.

## Solution

Replace the customer `<Select>` with a searchable combobox: a button trigger that opens a Popover containing a text Input and a filtered scrollable list.

## Scope

- **Only the deal create form** (`DealCreateForm.tsx`)
- No API changes, no schema changes, no new dependencies

## Components

### New: `CustomerCombobox.tsx`
Location: `src/app/[locale]/crm/deals/CustomerCombobox.tsx`

- `"use client"`
- Props: `customers: { id: number; name: string }[]`
- State: `open: boolean`, `query: string`, `selectedId: number | null`
- A hidden `<input name="customerId">` carries `selectedId ?? "none"` — form submit logic in `DealCreateForm` unchanged
- Trigger: a styled button showing selected customer name or placeholder text; clicking toggles Popover
- Popover content: text Input (autofocused on open) + scrollable list of filtered customers + "None" option at top
- Filtering: case-insensitive substring match on `customer.name`
- Selecting an item sets `selectedId`, clears `query`, closes Popover
- Uses existing `src/components/ui/popover.tsx` and `src/components/ui/input.tsx`

### Modified: `DealCreateForm.tsx`
- Remove: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` imports for the customer field
- Add: `CustomerCombobox` import
- Replace: `<Select name="customerId">...</Select>` block with `<CustomerCombobox customers={customers} />`
- Everything else (salesperson Select, form submit, error handling) unchanged

## Data Flow

```
new/page.tsx (server)
  → prisma.customer.findMany({ take: 300 })  [unchanged]
  → passes customers[] to DealCreateForm
      → passes customers[] to CustomerCombobox
          → filters in browser on each keystroke
          → hidden input carries selected id
      → form.get("customerId") reads hidden input  [unchanged]
```

## UI

```
[ Select customer ▼ ]          ← button trigger (unstyled: looks like Select)
┌──────────────────────────┐
│ [🔍 type to search...  ] │
│ — None                   │
│   บริษัท ABC             │
│   บริษัท XYZ             │
│   ...                    │
└──────────────────────────┘
```

## Out of Scope

- Editing customer on an existing deal (detail page is read-only)
- Async search API (not needed at this scale)
- Adding combobox to salesperson field (not requested)
