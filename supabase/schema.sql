-- Amplitude PM Flow — Supabase schema
-- Run once in the Supabase SQL editor (Project → SQL → New query → paste → Run).

-- 1) One row per feature. The whole checklist state lives in `data` (jsonb).
create table if not exists public.features (
  id uuid primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  title text not null default '',
  status text not null default '0',          -- '0'..'10' = step index, 'released', 'not-needed'
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists features_owner_idx on public.features(owner);
create index if not exists features_updated_idx on public.features(updated_at desc);

-- 2) Row-level security: everyone signed in can READ the map; only the owner can write their rows.
alter table public.features enable row level security;

drop policy if exists "read all features" on public.features;
create policy "read all features" on public.features
  for select to authenticated using (true);

drop policy if exists "insert own features" on public.features;
create policy "insert own features" on public.features
  for insert to authenticated with check (owner = auth.uid());

drop policy if exists "update own features" on public.features;
create policy "update own features" on public.features
  for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "delete own features" on public.features;
create policy "delete own features" on public.features
  for delete to authenticated using (owner = auth.uid());

-- 3) Only company emails may sign up (magic link). Change the domain if needed.
create or replace function public.enforce_email_domain()
returns trigger language plpgsql security definer as $$
begin
  if lower(new.email) not like '%@alefeducation.com' then
    raise exception 'Sign-in is limited to @alefeducation.com accounts';
  end if;
  return new;
end $$;
drop trigger if exists enforce_email_domain on auth.users;
create trigger enforce_email_domain before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- 4) A flat view for the feature map (handy for Power BI / exports).
create or replace view public.feature_map as
select id, title, owner_email, status,
       data->>'productLine'  as product_line,
       data->'roles'         as roles,
       data->'tenants'       as tenants,
       jsonb_array_length(coalesce(data->'journey','[]'::jsonb)) as moments,
       (data->>'released')::boolean as released,
       data->>'releasedAt'   as released_at,
       data->'jira'->>'key'  as jira_key,
       created_at, updated_at
from public.features;
