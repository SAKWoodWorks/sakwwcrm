-- Audit log for high-risk CRM mutations. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor_email TEXT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_target_idx
  ON public.audit_logs (target_type, target_id);
