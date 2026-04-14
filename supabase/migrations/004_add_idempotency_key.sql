-- Add idempotency_key to expenses for offline queue retry safety.
-- A queued client-side expense save generates a UUID at queue time;
-- repeated retry attempts send the same key so the server can detect
-- and skip duplicate inserts.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Partial unique index — only enforced when the key is present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_idempotency
  ON public.expenses (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
