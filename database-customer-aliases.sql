-- Customer aliases/former names.
-- Use this for company rename cases, e.g. old legal/trading names that should map
-- to one current customer record while remaining searchable.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.customer_aliases (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'former_name',
  tax_id TEXT,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_aliases_customer_id_idx
  ON public.customer_aliases (customer_id);

CREATE INDEX IF NOT EXISTS customer_aliases_alias_name_trgm_idx
  ON public.customer_aliases USING gin (alias_name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS customer_aliases_customer_alias_unique_idx
  ON public.customer_aliases (customer_id, lower(alias_name));

-- Known rename: Mahomepiboonkit -> Kit Mungmee Home.
-- Canonical customer remains/current is id=1843 after duplicate cleanup.
INSERT INTO public.customer_aliases (customer_id, alias_name, alias_type, tax_id, note)
SELECT
  1843,
  'บริษัท มาโฮมพิบูลกิจ จำกัด (สำนักงานใหญ่)',
  'former_name',
  '0415558000721',
  'Former company name before บริษัท กิจมั่งมีโฮม จำกัด'
WHERE EXISTS (SELECT 1 FROM public.customers WHERE id = 1843)
ON CONFLICT DO NOTHING;

UPDATE public.customers
SET name = 'บริษัท กิจมั่งมีโฮม จำกัด (สำนักงานใหญ่)'
WHERE id = 1843
  AND name <> 'บริษัท กิจมั่งมีโฮม จำกัด (สำนักงานใหญ่)';

-- Move existing old-name records into the canonical customer if they still exist.
UPDATE public.documents
SET customer_id = 1843
WHERE customer_id IN (104, 147)
  AND EXISTS (SELECT 1 FROM public.customers WHERE id = 1843);

UPDATE public.deals
SET customer_id = 1843
WHERE customer_id IN (104, 147)
  AND EXISTS (SELECT 1 FROM public.customers WHERE id = 1843);

UPDATE public.customers
SET tax_id = NULL
WHERE id IN (104, 147);

DELETE FROM public.customers
WHERE id IN (104, 147)
  AND EXISTS (SELECT 1 FROM public.customers WHERE id = 1843);

COMMIT;
