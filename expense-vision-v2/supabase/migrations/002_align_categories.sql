-- Migration: Align category values with frontend TypeScript types
-- DB previously used: food, transport, housing, utilities, entertainment, healthcare, shopping, education, travel, other
-- Frontend uses: Food & Dining, Transportation, Shopping, Entertainment, Bills & Utilities, Healthcare, Education, Travel, Groceries, Other

-- Step 1: Drop existing CHECK constraints
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_category_check;

-- Step 2: Migrate existing data to new category names
UPDATE public.expenses SET category = CASE category
  WHEN 'food' THEN 'Food & Dining'
  WHEN 'transport' THEN 'Transportation'
  WHEN 'housing' THEN 'Bills & Utilities'
  WHEN 'utilities' THEN 'Bills & Utilities'
  WHEN 'entertainment' THEN 'Entertainment'
  WHEN 'healthcare' THEN 'Healthcare'
  WHEN 'shopping' THEN 'Shopping'
  WHEN 'education' THEN 'Education'
  WHEN 'travel' THEN 'Travel'
  WHEN 'other' THEN 'Other'
  ELSE category -- leave already-migrated values alone
END
WHERE category IN ('food', 'transport', 'housing', 'utilities', 'entertainment', 'healthcare', 'shopping', 'education', 'travel', 'other');

UPDATE public.budgets SET category = CASE category
  WHEN 'food' THEN 'Food & Dining'
  WHEN 'transport' THEN 'Transportation'
  WHEN 'housing' THEN 'Bills & Utilities'
  WHEN 'utilities' THEN 'Bills & Utilities'
  WHEN 'entertainment' THEN 'Entertainment'
  WHEN 'healthcare' THEN 'Healthcare'
  WHEN 'shopping' THEN 'Shopping'
  WHEN 'education' THEN 'Education'
  WHEN 'travel' THEN 'Travel'
  WHEN 'other' THEN 'Other'
  ELSE category
END
WHERE category IN ('food', 'transport', 'housing', 'utilities', 'entertainment', 'healthcare', 'shopping', 'education', 'travel', 'other');

-- Step 3: Add new CHECK constraints matching frontend values
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Other'
  ));

ALTER TABLE public.budgets ADD CONSTRAINT budgets_category_check
  CHECK (category IN (
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Other'
  ));

-- Step 4: Also update the ai_insights insight_type constraint to include all types used
ALTER TABLE public.ai_insights DROP CONSTRAINT IF EXISTS ai_insights_insight_type_check;
ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_insight_type_check
  CHECK (insight_type IN (
    'spending_summary', 'savings_tip', 'budget_alert', 'trend_analysis'
  ));

-- Step 5: Add missing columns to expenses table to match TypeScript types
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Add updated_at trigger for expenses
CREATE TRIGGER IF NOT EXISTS set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Step 6: Handle duplicate budgets from housing -> Bills & Utilities merge
-- If both housing and utilities mapped to Bills & Utilities, keep the one with higher limit
DELETE FROM public.budgets a
USING public.budgets b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.category = b.category;
