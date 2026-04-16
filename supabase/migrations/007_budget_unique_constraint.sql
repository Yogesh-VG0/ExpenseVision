-- Enforce one budget per (user_id, category) at the database level.
-- Previously enforced only in application code.
--
-- If duplicates already exist, this will fail. Clean up first:
-- DELETE FROM budgets WHERE id NOT IN (
--   SELECT DISTINCT ON (user_id, category) id FROM budgets ORDER BY user_id, category, created_at
-- );

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category
  ON budgets (user_id, category);
