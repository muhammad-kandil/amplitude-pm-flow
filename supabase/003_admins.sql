-- Admin role: admins see and can edit every feature; everyone else only their own.
create table if not exists public.admins (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "see own admin row" on public.admins;
create policy "see own admin row" on public.admins
  for select to authenticated using (lower(email) = lower(auth.jwt()->>'email'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt()->>'email'));
$$;

drop policy if exists "read all features" on public.features;
drop policy if exists "read own or admin" on public.features;
create policy "read own or admin" on public.features
  for select to authenticated using (lower(owner_email) = lower(auth.jwt()->>'email') or public.is_admin());

drop policy if exists "update own features" on public.features;
create policy "update own features" on public.features
  for update to authenticated
  using (lower(owner_email) = lower(auth.jwt()->>'email') or public.is_admin())
  with check (lower(owner_email) = lower(auth.jwt()->>'email') or public.is_admin());

drop policy if exists "delete own features" on public.features;
create policy "delete own features" on public.features
  for delete to authenticated using (lower(owner_email) = lower(auth.jwt()->>'email') or public.is_admin());

-- The map view must respect the policies above.
drop view if exists public.feature_map;
create view public.feature_map with (security_invoker = true) as
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

-- First admin. Add more rows here or in Table Editor → admins.
insert into public.admins(email) values ('muhammad.kandil@alefeducation.com') on conflict do nothing;
