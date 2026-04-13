-- ExpenseVision Database Schema
-- Run this in Supabase SQL Editor or via supabase db push

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  category text not null check (category in (
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Other'
  )),
  vendor text,
  description text,
  date date not null,
  is_recurring boolean not null default false,
  receipt_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(user_id, date desc);
create index if not exists idx_expenses_category on public.expenses(user_id, category);

-- ============================================================
-- BUDGETS TABLE
-- ============================================================
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  category text not null check (category in (
    'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
    'Bills & Utilities', 'Healthcare', 'Education', 'Travel', 'Groceries', 'Other'
  )),
  monthly_limit numeric(10,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique(user_id, category)
);

create index if not exists idx_budgets_user_id on public.budgets(user_id);

-- ============================================================
-- AI INSIGHTS TABLE
-- ============================================================
create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  insight_type text not null check (insight_type in (
    'spending_summary', 'savings_tip', 'budget_alert', 'trend_analysis'
  )),
  content text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_insights_user_id on public.ai_insights(user_id);

-- ============================================================
-- RECEIPTS TABLE (for OCR metadata)
-- ============================================================
create table if not exists public.receipts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  expense_id uuid references public.expenses on delete set null,
  file_url text not null,
  ocr_data jsonb,
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_receipts_user_id on public.receipts(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.ai_insights enable row level security;
alter table public.receipts enable row level security;

-- PROFILES: Users can only read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- EXPENSES: Full CRUD on own expenses only
create policy "Users can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

create policy "Users can create own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- BUDGETS: Full CRUD on own budgets only
create policy "Users can view own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users can create own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- AI INSIGHTS: Read/create own insights
create policy "Users can view own insights"
  on public.ai_insights for select
  using (auth.uid() = user_id);

create policy "Users can create own insights"
  on public.ai_insights for insert
  with check (auth.uid() = user_id);

-- RECEIPTS: Full CRUD on own receipts
create policy "Users can view own receipts"
  on public.receipts for select
  using (auth.uid() = user_id);

create policy "Users can create own receipts"
  on public.receipts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own receipts"
  on public.receipts for delete
  using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (for receipt images)
-- ============================================================
-- Run this separately in Supabase Dashboard > Storage:
-- Create bucket "receipts" with:
--   - Public: false
--   - File size limit: 10MB
--   - Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
--
-- Then add these storage policies:
-- insert policy: (auth.uid() = (storage.foldername(name))[1]::uuid)
-- select policy: (auth.uid() = (storage.foldername(name))[1]::uuid)
-- delete policy: (auth.uid() = (storage.foldername(name))[1]::uuid)

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.handle_updated_at();
