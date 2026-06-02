-- Allow duplicate customer TAX IDs so duplicate-customer cleanup can group
-- customers that share the same tax number.

DROP INDEX IF EXISTS customers_tax_id_key;
DROP INDEX IF EXISTS customers_tax_id_idx;

CREATE INDEX IF NOT EXISTS customers_tax_id_idx
ON customers (tax_id)
WHERE tax_id IS NOT NULL;
