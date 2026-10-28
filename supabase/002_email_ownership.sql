-- Ownership by email (so a PM whose account is reset keeps their features). Run after schema.sql.
alter table public.features drop constraint if exists features_owner_fkey;
alter table public.features alter column owner drop not null;

drop policy if exists "insert own features" on public.features;
create policy "insert own features" on public.features
  for insert to authenticated with check (lower(owner_email) = lower(auth.jwt()->>'email'));

drop policy if exists "update own features" on public.features;
create policy "update own features" on public.features
  for update to authenticated using (lower(owner_email) = lower(auth.jwt()->>'email')) with check (lower(owner_email) = lower(auth.jwt()->>'email'));

drop policy if exists "delete own features" on public.features;
create policy "delete own features" on public.features
  for delete to authenticated using (lower(owner_email) = lower(auth.jwt()->>'email'));
