-- Lightweight heartbeat row for scheduled keep-alive pings (no user data).
-- Used by GitHub Actions and /api/warmup to generate Data API activity.

create table if not exists public.project_heartbeat (
  id text primary key default 'singleton' check (id = 'singleton'),
  last_ping_at timestamptz not null default now()
);

insert into public.project_heartbeat (id, last_ping_at)
values ('singleton', now())
on conflict (id) do nothing;

alter table public.project_heartbeat enable row level security;

create policy "Public read project heartbeat"
  on public.project_heartbeat
  for select
  to anon, authenticated
  using (true);

grant select on public.project_heartbeat to anon;
grant select on public.project_heartbeat to authenticated;
grant select, update on public.project_heartbeat to service_role;
