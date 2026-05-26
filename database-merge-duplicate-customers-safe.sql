-- Merge conservative duplicate customers.
--
-- Scope:
-- - Same normalized Tax ID, extracted from customers.tax_id or from digits inside customers.name.
-- - Same rough customer name after punctuation normalization.
-- - This intentionally skips ambiguous cases where the same phone/tax-like digits may belong to different names.
--
-- Safe to run after a DB backup. Re-run should be harmless because merged duplicate rows are deleted.

BEGIN;

CREATE TEMP TABLE duplicate_customer_merge_map AS
WITH doc_counts AS (
  SELECT
    customer_id,
    COUNT(*) AS docs,
    MAX(doc_date) AS last_doc
  FROM public.documents
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
),
base AS (
  SELECT
    c.id,
    c.name,
    c.tax_id,
    c.phone,
    c.email,
    c.line_id,
    c.other_id,
    c.address,
    c.province,
    c.type,
    c.status,
    c.salesperson_id,
    c.vat_registered,
    COALESCE(dc.docs, 0) AS docs,
    dc.last_doc,
    regexp_replace(COALESCE(c.tax_id, ''), '[^0-9]', '', 'g') AS tax_digits,
    regexp_replace(COALESCE(c.name, ''), '[^0-9]', '', 'g') AS name_digits,
    regexp_replace(lower(c.name), '[^[:alnum:]ก-๙]+', ' ', 'g') AS rough_name
  FROM public.customers c
  LEFT JOIN doc_counts dc ON dc.customer_id = c.id
),
keyed AS (
  SELECT
    *,
    CASE
      WHEN length(tax_digits) >= 10 THEN tax_digits
      WHEN length(name_digits) >= 13 THEN substring(name_digits from '.{13}$')
      ELSE NULL
    END AS tax_key
  FROM base
),
safe_groups AS (
  SELECT tax_key
  FROM keyed
  WHERE tax_key IS NOT NULL
  GROUP BY tax_key
  HAVING COUNT(*) > 1
     AND COUNT(DISTINCT rough_name) = 1
),
ranked AS (
  SELECT
    k.*,
    first_value(id) OVER (
      PARTITION BY k.tax_key
      ORDER BY
        CASE WHEN nullif(trim(tax_id), '') IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN lower(name) LIKE '%tax%' OR name LIKE '%เลขประจำตัวผู้เสียภาษี%' OR name LIKE '%ทะเบียนนิติบุคคล%' THEN 1 ELSE 0 END,
        docs DESC,
        last_doc DESC NULLS LAST,
        id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY k.tax_key
      ORDER BY
        CASE WHEN nullif(trim(tax_id), '') IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN lower(name) LIKE '%tax%' OR name LIKE '%เลขประจำตัวผู้เสียภาษี%' OR name LIKE '%ทะเบียนนิติบุคคล%' THEN 1 ELSE 0 END,
        docs DESC,
        last_doc DESC NULLS LAST,
        id ASC
    ) AS rn
  FROM keyed k
  JOIN safe_groups g ON g.tax_key = k.tax_key
)
SELECT
  tax_key,
  keep_id,
  id AS duplicate_id
FROM ranked
WHERE rn > 1;

-- Preview before changes.
SELECT
  m.tax_key,
  m.keep_id,
  kc.name AS keep_name,
  COUNT(*) AS duplicate_rows,
  array_agg(m.duplicate_id ORDER BY m.duplicate_id) AS duplicate_ids,
  COALESCE(SUM(doc_count.docs), 0) AS documents_to_move,
  COALESCE(SUM(deal_count.deals), 0) AS deals_to_move
FROM duplicate_customer_merge_map m
JOIN public.customers kc ON kc.id = m.keep_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS docs
  FROM public.documents d
  WHERE d.customer_id = m.duplicate_id
) doc_count ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS deals
  FROM public.deals de
  WHERE de.customer_id = m.duplicate_id
) deal_count ON TRUE
GROUP BY m.tax_key, m.keep_id, kc.name
ORDER BY duplicate_rows DESC, m.tax_key;

-- Fill missing canonical fields on kept customers from duplicate rows before deleting them.
WITH source_values AS (
  SELECT
    m.keep_id,
    m.tax_key,
    (array_agg(NULLIF(trim(c.phone), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.phone), '') IS NOT NULL))[1] AS phone,
    (array_agg(NULLIF(trim(c.email), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.email), '') IS NOT NULL))[1] AS email,
    (array_agg(NULLIF(trim(c.line_id), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.line_id), '') IS NOT NULL))[1] AS line_id,
    (array_agg(NULLIF(trim(c.other_id), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.other_id), '') IS NOT NULL))[1] AS other_id,
    (array_agg(NULLIF(trim(c.address), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.address), '') IS NOT NULL))[1] AS address,
    (array_agg(NULLIF(trim(c.province), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.province), '') IS NOT NULL))[1] AS province,
    (array_agg(NULLIF(trim(c.type), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.type), '') IS NOT NULL))[1] AS type,
    (array_agg(NULLIF(trim(c.status), '') ORDER BY c.id) FILTER (WHERE NULLIF(trim(c.status), '') IS NOT NULL))[1] AS status,
    (array_agg(c.salesperson_id ORDER BY c.id) FILTER (WHERE c.salesperson_id IS NOT NULL))[1] AS salesperson_id
  FROM duplicate_customer_merge_map m
  JOIN public.customers c ON c.id IN (m.keep_id, m.duplicate_id)
  GROUP BY m.keep_id, m.tax_key
)
UPDATE public.customers keep
SET
  tax_id = COALESCE(NULLIF(trim(keep.tax_id), ''), source_values.tax_key),
  phone = COALESCE(NULLIF(trim(keep.phone), ''), source_values.phone),
  email = COALESCE(NULLIF(trim(keep.email), ''), source_values.email),
  line_id = COALESCE(NULLIF(trim(keep.line_id), ''), source_values.line_id),
  other_id = COALESCE(NULLIF(trim(keep.other_id), ''), source_values.other_id),
  address = COALESCE(NULLIF(trim(keep.address), ''), source_values.address),
  province = COALESCE(NULLIF(trim(keep.province), ''), source_values.province),
  type = COALESCE(NULLIF(trim(keep.type), ''), source_values.type),
  status = COALESCE(NULLIF(trim(keep.status), ''), source_values.status, keep.status),
  salesperson_id = COALESCE(keep.salesperson_id, source_values.salesperson_id)
FROM source_values
WHERE keep.id = source_values.keep_id;

UPDATE public.documents d
SET customer_id = m.keep_id
FROM duplicate_customer_merge_map m
WHERE d.customer_id = m.duplicate_id;

UPDATE public.deals de
SET customer_id = m.keep_id
FROM duplicate_customer_merge_map m
WHERE de.customer_id = m.duplicate_id;

-- Avoid unique tax_id collisions while deleting duplicate customer rows.
UPDATE public.customers c
SET tax_id = NULL
FROM duplicate_customer_merge_map m
WHERE c.id = m.duplicate_id;

DELETE FROM public.customers c
USING duplicate_customer_merge_map m
WHERE c.id = m.duplicate_id;

-- Verify result for this conservative class.
WITH base AS (
  SELECT
    id,
    name,
    tax_id,
    regexp_replace(COALESCE(tax_id, ''), '[^0-9]', '', 'g') AS tax_digits,
    regexp_replace(COALESCE(name, ''), '[^0-9]', '', 'g') AS name_digits,
    regexp_replace(lower(name), '[^[:alnum:]ก-๙]+', ' ', 'g') AS rough_name
  FROM public.customers
),
keyed AS (
  SELECT
    *,
    CASE
      WHEN length(tax_digits) >= 10 THEN tax_digits
      WHEN length(name_digits) >= 13 THEN substring(name_digits from '.{13}$')
      ELSE NULL
    END AS tax_key
  FROM base
)
SELECT
  COUNT(*) AS remaining_safe_duplicate_groups
FROM (
  SELECT tax_key
  FROM keyed
  WHERE tax_key IS NOT NULL
  GROUP BY tax_key
  HAVING COUNT(*) > 1
     AND COUNT(DISTINCT rough_name) = 1
) remaining;

COMMIT;
