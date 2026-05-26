-- Speed up CRM list pages. Safe to re-run.
-- Run on production after git pull:
-- docker compose exec -T db psql -U crm -d crm_db -v ON_ERROR_STOP=1 < database-performance-indexes.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS documents_customer_tax_invoice_latest_idx
  ON public.documents (customer_id, doc_date DESC, id DESC)
  INCLUDE (total)
  WHERE doc_type = 'tax_invoice';

CREATE INDEX IF NOT EXISTS documents_paid_invoice_customer_date_idx
  ON public.documents (customer_id, doc_date DESC, id DESC)
  INCLUDE (total)
  WHERE doc_type = 'tax_invoice' AND payment_status = 'paid';

CREATE INDEX IF NOT EXISTS documents_paid_invoice_date_customer_idx
  ON public.documents (doc_date DESC, customer_id, id DESC)
  INCLUDE (total)
  WHERE doc_type = 'tax_invoice' AND payment_status = 'paid';

CREATE INDEX IF NOT EXISTS documents_pending_tax_invoice_idx
  ON public.documents (id)
  WHERE doc_type = 'tax_invoice' AND payment_status = 'pending';

CREATE INDEX IF NOT EXISTS documents_tax_invoice_date_total_idx
  ON public.documents (doc_date DESC, id DESC)
  INCLUDE (total, customer_id)
  WHERE doc_type = 'tax_invoice';

CREATE INDEX IF NOT EXISTS documents_quotation_date_total_idx
  ON public.documents (doc_date DESC, id DESC)
  INCLUDE (total)
  WHERE doc_type = 'quotation';

CREATE INDEX IF NOT EXISTS documents_salesperson_tax_invoice_customer_date_idx
  ON public.documents (salesperson_id, customer_id, doc_date DESC, id DESC)
  WHERE doc_type = 'tax_invoice';

CREATE INDEX IF NOT EXISTS documents_doc_date_idx
  ON public.documents (doc_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS documents_doc_type_doc_date_idx
  ON public.documents (doc_type, doc_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS documents_payment_status_doc_date_idx
  ON public.documents (payment_status, doc_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS documents_channel_doc_date_idx
  ON public.documents (channel, doc_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS documents_salesperson_doc_date_idx
  ON public.documents (salesperson_id, doc_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS customers_name_idx
  ON public.customers (name);

CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON public.customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_tax_id_trgm_idx
  ON public.customers USING gin (tax_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_salesperson_id_idx
  ON public.customers (salesperson_id);

CREATE INDEX IF NOT EXISTS customers_created_at_idx
  ON public.customers (created_at DESC);

ANALYZE public.documents;
ANALYZE public.customers;
