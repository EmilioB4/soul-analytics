-- Invite-only first release. Run as postgres in Supabase SQL Editor.
-- Existing rows and legacy marketplace bindings are preserved.
begin;
create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.profiles enable row level security;
-- Admission is controlled by the operator, never browser signup or user metadata.
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists soul_profile_read on public.profiles;
create policy soul_profile_read on public.profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists soul_profile_isolation on public.profiles;
create policy soul_profile_isolation on public.profiles as restrictive for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create table if not exists public.walmart_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 client_fingerprint text not null unique,
 client_id_encrypted text not null,
 client_secret_encrypted text not null,
 updated_at timestamptz not null default now()
);
alter table public.walmart_connections enable row level security;
revoke all on public.walmart_connections from public, anon, authenticated;
grant all on public.walmart_connections to service_role;
-- Prevent concurrent first-connect requests from switching historical ownership.
create or replace function public.keep_walmart_client_identity() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.client_fingerprint is distinct from old.client_fingerprint then
  raise exception 'Walmart Client ID cannot be replaced for this account';
 end if;
 return new;
end $$;
revoke all on function public.keep_walmart_client_identity() from public,anon,authenticated;
drop trigger if exists walmart_client_identity on public.walmart_connections;
create trigger walmart_client_identity before update on public.walmart_connections
for each row execute function public.keep_walmart_client_identity();
-- Defense in depth: restrictive ownership applies even if an older permissive
-- policy exists. Do not replace existing narrower policies or change table data.
do $$
declare t record;
begin
 for t in select c.table_name from information_schema.columns c join information_schema.tables s using(table_schema,table_name)
  where c.table_schema='public' and c.column_name='owner_id' and c.udt_name='uuid' and s.table_type='BASE TABLE'
 loop
  execute format('alter table public.%I enable row level security',t.table_name);
  execute format('revoke all on public.%I from public, anon',t.table_name);
  -- RLS does not protect TRUNCATE; browser roles must never retain it.
  execute format('revoke truncate, references, trigger on public.%I from authenticated',t.table_name);
  execute format('drop policy if exists soul_tenant_isolation on public.%I',t.table_name);
  execute format('create policy soul_tenant_isolation on public.%I as restrictive for all to authenticated using (owner_id=auth.uid() and exists(select 1 from public.profiles where user_id=auth.uid())) with check (owner_id=auth.uid() and exists(select 1 from public.profiles where user_id=auth.uid()))',t.table_name);
 end loop;
end $$;
-- Credential tables stay entirely server-only, regardless of previous policies.
do $$
declare name text;
begin
 foreach name in array array['tiktok_connections','plaid_connections','payout_alert_settings','walmart_connections'] loop
  if to_regclass('public.'||name) is not null then
   execute format('revoke all on public.%I from public, anon, authenticated',name);
   execute format('grant all on public.%I to service_role',name);
  end if;
 end loop;
end $$;
-- Removing admission also disables future scheduled work for that account.
create or replace function public.pause_removed_account() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare name text;
begin
 foreach name in array array['order_auto_syncs','payout_alert_settings'] loop
  if to_regclass('public.'||name) is not null then
   execute format('update public.%I set enabled=false where owner_id=$1',name) using old.user_id;
  end if;
 end loop;
 return old;
end $$;
revoke all on function public.pause_removed_account() from public,anon,authenticated;
drop trigger if exists soul_pause_removed_account on public.profiles;
create trigger soul_pause_removed_account after delete on public.profiles
for each row execute function public.pause_removed_account();
notify pgrst,'reload schema';
commit;
