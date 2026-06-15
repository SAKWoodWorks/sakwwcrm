-- Background import job tracking for /crm/import. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  actor_email TEXT,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS import_jobs_status_created_at_idx
  ON public.import_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS import_jobs_created_at_idx
  ON public.import_jobs (created_at DESC);
