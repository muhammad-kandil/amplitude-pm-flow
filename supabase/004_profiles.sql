-- Users & roles managed from the web page.
-- One row per person who has signed in; role is 'pm' or 'admin'. Replaces the admins table.
create table if not exists public.profiles (
  email text primary key,
  role text not null default 'pm' check (role in ('pm','admin')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- is_admin() now reads profiles
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where lower(email) = lower(auth.jwt()->>'email') and role = 'admin');
$$;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select to authenticated using (lower(email) = lower(auth.jwt()->>'email') or public.is_admin());

-- Only admins change roles, and never their own row (so there is always one admin left).
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
  for update to authenticated
  using (public.is_admin() and lower(email) <> lower(auth.jwt()->>'email'))
  with check (public.is_admin() and lower(email) <> lower(auth.jwt()->>'email'));

-- Each sign-in records the person (insert or bump last_seen) without touching the role.
create or replace function public.touch_profile()
returns void language sql security definer set search_path = public as $$
  insert into public.profiles(email) values (lower(auth.jwt()->>'email'))
  on conflict (email) do update set last_seen = now();
$$;
grant execute on function public.touch_profile() to authenticated;

-- Also register people the moment their account is created.
create or replace function public.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(email) values (lower(new.email)) on conflict (email) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- Carry over existing admins and existing users, then retire the admins table.
insert into public.profiles(email, role) select lower(email), 'admin' from public.admins
  on conflict (email) do update set role = 'admin';
insert into public.profiles(email) select lower(email) from auth.users where email is not null
  on conflict (email) do nothing;
drop table if exists public.admins;
