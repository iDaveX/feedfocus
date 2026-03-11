-- FeedFocus (MVP) schema

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null unique,
  telegram_user_id bigint unique,
  created_at timestamptz not null default now()
);

-- Migration helpers (for older Telegram-based schemas)
alter table public.users add column if not exists anon_id text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'telegram_user_id'
  ) then
    begin
      alter table public.users alter column telegram_user_id drop not null;
    exception when others then
      null;
    end;
  end if;
end $$;

update public.users
set anon_id = coalesce(
  anon_id,
  case when telegram_user_id is not null then 'tg_' || telegram_user_id::text else null end,
  gen_random_uuid()::text
)
where anon_id is null;

alter table public.users alter column anon_id set not null;
create unique index if not exists users_anon_id_key on public.users (anon_id);
create unique index if not exists users_anon_id_idx on public.users (anon_id);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  input_raw text not null,
  input_items jsonb not null,
  main_insight text,
  model text not null,
  status text not null check (status in ('completed', 'failed')),
  error text
);

alter table public.analyses add column if not exists main_insight text;

create index if not exists analyses_user_created_at_idx on public.analyses (user_id, created_at desc);
create index if not exists analyses_created_at_idx on public.analyses (created_at desc);

create table if not exists public.pain_points (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  created_at timestamptz not null default now(),
  llm_key text,
  title text not null,
  summary text not null,
  evidence_count integer not null check (evidence_count >= 0),
  quotes jsonb not null,
  cjm_stage text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  confidence text not null check (confidence in ('low', 'medium', 'high'))
);

create index if not exists pain_points_analysis_idx on public.pain_points (analysis_id);
create index if not exists pain_points_stage_idx on public.pain_points (cjm_stage);

create table if not exists public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  pain_point_id uuid not null references public.pain_points(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  hypothesis text not null,
  expected_impact text not null check (expected_impact in ('low', 'medium', 'high')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  status text not null check (status in ('new', 'testing', 'validated', 'rejected'))
);

create index if not exists hypotheses_analysis_idx on public.hypotheses (analysis_id);
create index if not exists hypotheses_status_idx on public.hypotheses (status);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists events_user_created_at_idx on public.events (user_id, created_at desc);
create index if not exists events_name_idx on public.events (name);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_hypotheses_updated_at on public.hypotheses;
create trigger set_hypotheses_updated_at
before update on public.hypotheses
for each row execute function public.set_updated_at();
