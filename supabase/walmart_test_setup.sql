-- WALMART TEST PROJECT SETUP
-- Run the entire file in the testing Supabase project SQL Editor as postgres.
-- Preserves existing accounts and data; safe to rerun. No secrets or sample store data.
-- Creates Walmart tables and per-user connection/access rules.
-- Background schedulers and Discord alerts are configured separately, after a successful manual import.

begin;

-- SOURCE: walmart_core.sql
-- Core Walmart reporting tables for a fresh project. No account data is seeded.
create table if not exists public.walmart_sales (
 owner_id uuid not null references auth.users(id) on delete cascade,
 order_id text not null,
 line_id text not null,
 order_date timestamptz not null,
 sku text not null,
 product_name text not null,
 fulfillment text not null check(fulfillment in ('WFS','SF','Unknown')),
 quantity integer not null check(quantity>0),
 revenue numeric(16,2) not null,
 primary key(owner_id,order_id,line_id)
);
create index if not exists walmart_sales_owner_date_idx on public.walmart_sales(owner_id,order_date);
create table if not exists public.walmart_fees (
 owner_id uuid not null references auth.users(id) on delete cascade,
 transaction_id text not null,
 fee_date date not null,
 sku text,
 order_id text,
 fee_type text not null,
 amount numeric(16,2) not null,
 primary key(owner_id,transaction_id)
);
create index if not exists walmart_fees_owner_date_idx on public.walmart_fees(owner_id,fee_date);
create table if not exists public.walmart_product_costs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 unit_cogs numeric(16,4) not null check(unit_cogs>=0),
 primary key(owner_id,sku)
);
alter table public.walmart_sales enable row level security;
alter table public.walmart_fees enable row level security;
alter table public.walmart_product_costs enable row level security;
drop policy if exists walmart_sales_own on public.walmart_sales;
create policy walmart_sales_own on public.walmart_sales for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists walmart_fees_own on public.walmart_fees;
create policy walmart_fees_own on public.walmart_fees for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists walmart_costs_own on public.walmart_product_costs;
create policy walmart_costs_own on public.walmart_product_costs for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant select,insert,update,delete on public.walmart_sales,public.walmart_fees,public.walmart_product_costs to authenticated;
grant all on public.walmart_sales,public.walmart_fees,public.walmart_product_costs to service_role;


-- SOURCE: walmart_settlements.sql
-- Run once in the Supabase SQL Editor before syncing Walmart settlements.
-- Existing CSV fees are preserved. Do not manually import charges also in these reports.
create table if not exists public.walmart_settlement_transactions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 report_date text not null,
 row_index integer not null,
 posted_date date not null,
 order_id text,
 line_id text,
 sku text,
 fee_type text not null,
 kind text not null check (kind in ('fee','refund','sale','tax','transfer','unknown')),
 amount numeric(16,2) not null,
 currency text not null check(currency='USD'),
 raw jsonb not null,
 primary key(owner_id,report_date,row_index)
);
create index if not exists walmart_settlement_order_idx on public.walmart_settlement_transactions(owner_id,order_id);
create table if not exists public.walmart_settlement_reports (
 owner_id uuid not null references auth.users(id) on delete cascade,
 report_date text not null,
 imported_at timestamptz not null default now(),
 transaction_count integer not null,
 unknown_count integer not null,
 primary key(owner_id,report_date)
);
alter table public.walmart_settlement_transactions enable row level security;
alter table public.walmart_settlement_reports enable row level security;
drop policy if exists walmart_settlement_read on public.walmart_settlement_transactions;
create policy walmart_settlement_read on public.walmart_settlement_transactions for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_report_read on public.walmart_settlement_reports;
create policy walmart_report_read on public.walmart_settlement_reports for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_settlement_transactions,public.walmart_settlement_reports to authenticated;
grant all on public.walmart_settlement_transactions,public.walmart_settlement_reports to service_role;
-- Replace a whole report in one transaction, so retries and corrections cannot
-- duplicate charges or leave a partial report included in profit.
create or replace function public.replace_walmart_settlement_report(p_owner uuid,p_report_date text,p_rows jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_report_date,0));
 delete from public.walmart_settlement_transactions where owner_id=p_owner and report_date=p_report_date;
 insert into public.walmart_settlement_transactions
 select p_owner,p_report_date,x.row_index,x.posted_date,x.order_id,x.line_id,x.sku,x.fee_type,x.kind,x.amount,x.currency,x.raw
 from jsonb_to_recordset(p_rows) as x(row_index integer,posted_date date,order_id text,line_id text,sku text,fee_type text,kind text,amount numeric,currency text,raw jsonb);
 insert into public.walmart_settlement_reports(owner_id,report_date,imported_at,transaction_count,unknown_count)
 values(p_owner,p_report_date,now(),jsonb_array_length(p_rows),(select count(*) from jsonb_array_elements(p_rows) r where r->>'kind'='unknown'))
 on conflict(owner_id,report_date) do update set imported_at=excluded.imported_at,transaction_count=excluded.transaction_count,unknown_count=excluded.unknown_count;
end $$;
revoke all on function public.replace_walmart_settlement_report(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_walmart_settlement_report(uuid,text,jsonb) to service_role;


-- SOURCE: walmart_inventory.sql
-- One-time inventory setup. This does not change sales, fees, settlements or COGS.
create table if not exists public.walmart_inventory_lots (
 owner_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null,
 data jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,external_id),
 check(jsonb_typeof(data)='object'),
 check(data->>'id'=external_id),
 check(length(data->>'sku')>0 and length(data->>'name')>0),
 check((data->>'qty')::numeric>=0 and (data->>'qty')::numeric=trunc((data->>'qty')::numeric)),
 check((data->>'sold')::numeric>=0 and (data->>'sold')::numeric=trunc((data->>'sold')::numeric)),
 check((data->>'left')::numeric=(data->>'qty')::numeric-(data->>'sold')::numeric and (data->>'left')::numeric>=0)
);
create table if not exists public.walmart_inventory_history (
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null,
 reason text not null,
 changed_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb not null
);
create index if not exists walmart_inventory_history_owner_idx on public.walmart_inventory_history(owner_id,changed_at desc);
alter table public.walmart_inventory_lots enable row level security;
alter table public.walmart_inventory_history enable row level security;
drop policy if exists walmart_inventory_read on public.walmart_inventory_lots;
create policy walmart_inventory_read on public.walmart_inventory_lots for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_inventory_history_read on public.walmart_inventory_history;
create policy walmart_inventory_history_read on public.walmart_inventory_history for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_inventory_lots,public.walmart_inventory_history to authenticated;
grant all on public.walmart_inventory_lots,public.walmart_inventory_history to service_role;
grant usage,select on sequence public.walmart_inventory_history_id_seq to service_role;
create or replace function public.log_walmart_inventory_change() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 insert into public.walmart_inventory_history(owner_id,external_id,reason,before_data,after_data)
 values(new.owner_id,new.external_id,coalesce(nullif(current_setting('app.inventory_reason',true),''),'Inventory update'),case when TG_OP='UPDATE' then old.data else null end,new.data);
 return new;
end $$;
drop trigger if exists walmart_inventory_audit on public.walmart_inventory_lots;
create trigger walmart_inventory_audit after insert or update on public.walmart_inventory_lots for each row execute function public.log_walmart_inventory_change();
create or replace function public.save_walmart_inventory(p_owner uuid,p_rows jsonb,p_reason text,p_expected_version text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb; existing_version timestamptz;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>5000 then raise exception 'Invalid inventory import size';end if;
 if p_expected_version is not null and jsonb_array_length(p_rows)<>1 then raise exception 'Edit requires one lot';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':walmart-inventory',0));
 perform set_config('app.inventory_reason',left(p_reason,300),true);
 for item in select value from jsonb_array_elements(p_rows) loop
  if p_expected_version is not null then
   select updated_at into existing_version from public.walmart_inventory_lots where owner_id=p_owner and external_id=item->>'id';
   if existing_version is null or existing_version<>p_expected_version::timestamptz then raise exception 'Inventory changed in another session';end if;
  end if;
  insert into public.walmart_inventory_lots(owner_id,external_id,data) values(p_owner,item->>'id',item)
  on conflict(owner_id,external_id) do update set data=excluded.data,updated_at=clock_timestamp()
  where walmart_inventory_lots.data is distinct from excluded.data;
 end loop;
end $$;
revoke all on function public.save_walmart_inventory(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_walmart_inventory(uuid,jsonb,text,text) to service_role;
revoke all on function public.log_walmart_inventory_change() from public,anon,authenticated;
grant execute on function public.log_walmart_inventory_change() to service_role;


-- SOURCE: walmart_wfs_inventory.sql
-- Run once to enable Walmart WFS stock/status tracking. No purchase lots,
-- sales or historical COGS are changed by this migration or by WFS sync.
create table if not exists public.walmart_wfs_inventory (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 data jsonb not null,
 last_seen_at timestamptz not null default now(),
 stale boolean not null default false,
 primary key(owner_id,sku),
 check(data->>'sku'=sku),
 check((data->>'available')::numeric>=0 and (data->>'reserved')::numeric>=0 and (data->>'inbound')::numeric>=0 and (data->>'on_hand')::numeric>=0)
);
create table if not exists public.walmart_wfs_syncs (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 last_sync_at timestamptz,
 last_attempt_at timestamptz,
 last_error text,
 lease_token uuid,
 lease_until timestamptz
);
create table if not exists public.walmart_wfs_changes (
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 changed_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb not null
);
create index if not exists walmart_wfs_changes_owner_idx on public.walmart_wfs_changes(owner_id,changed_at desc);
alter table public.walmart_wfs_inventory enable row level security;
alter table public.walmart_wfs_syncs enable row level security;
alter table public.walmart_wfs_changes enable row level security;
drop policy if exists walmart_wfs_inventory_read on public.walmart_wfs_inventory;
create policy walmart_wfs_inventory_read on public.walmart_wfs_inventory for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_wfs_syncs_read on public.walmart_wfs_syncs;
create policy walmart_wfs_syncs_read on public.walmart_wfs_syncs for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_wfs_changes_read on public.walmart_wfs_changes;
create policy walmart_wfs_changes_read on public.walmart_wfs_changes for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_wfs_inventory,public.walmart_wfs_syncs,public.walmart_wfs_changes to authenticated;
grant all on public.walmart_wfs_inventory,public.walmart_wfs_syncs,public.walmart_wfs_changes to service_role;
grant usage,select on sequence public.walmart_wfs_changes_id_seq to service_role;
create or replace function public.claim_walmart_wfs_sync(p_owner uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare s public.walmart_wfs_syncs; token uuid;
begin
 insert into public.walmart_wfs_syncs(owner_id) values(p_owner) on conflict(owner_id) do nothing;
 select * into s from public.walmart_wfs_syncs where owner_id=p_owner for update;
 if not s.enabled or s.lease_until>now() or s.last_attempt_at>now()-interval '60 seconds' then return null;end if;
 token=gen_random_uuid();
 update public.walmart_wfs_syncs set lease_token=token,lease_until=now()+interval '90 seconds',last_attempt_at=now() where owner_id=p_owner;
 return token;
end $$;
create or replace function public.replace_walmart_wfs_inventory(p_owner uuid,p_items jsonb,p_lease uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare item jsonb; previous jsonb; key text;
begin
 perform 1 from public.walmart_wfs_syncs where owner_id=p_owner and lease_token=p_lease and lease_until>now() for update;
 if not found then raise exception 'WFS sync lease expired or changed; previous stock preserved';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50000 then raise exception 'Invalid WFS snapshot';end if;
 if (select count(distinct value->>'sku') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate or missing WFS SKU';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  key=item->>'sku';
  if key is null or key='' then raise exception 'Missing WFS SKU';end if;
  select data into previous from public.walmart_wfs_inventory where owner_id=p_owner and sku=key;
  if previous is null or (previous-'price_seen_at'-'price_error') is distinct from (item-'price_seen_at'-'price_error') then
   insert into public.walmart_wfs_changes(owner_id,sku,before_data,after_data) values(p_owner,key,previous,item);
  end if;
  insert into public.walmart_wfs_inventory(owner_id,sku,data,last_seen_at,stale) values(p_owner,key,item,now(),false)
  on conflict(owner_id,sku) do update set data=excluded.data,last_seen_at=excluded.last_seen_at,stale=false;
 end loop;
 -- An absent catalog item is unknown/stale, not a zero-quantity sale.
 update public.walmart_wfs_inventory set stale=true where owner_id=p_owner and sku not in(select value->>'sku' from jsonb_array_elements(p_items));
 update public.walmart_wfs_syncs set last_sync_at=now(),last_error=null,lease_token=null,lease_until=null where owner_id=p_owner;
end $$;
revoke all on function public.claim_walmart_wfs_sync(uuid) from public,anon,authenticated;
revoke all on function public.replace_walmart_wfs_inventory(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.claim_walmart_wfs_sync(uuid),public.replace_walmart_wfs_inventory(uuid,jsonb,uuid) to service_role;

-- Conservative planning assumptions. Estimates are computed at display time;
-- they are never inserted into the actual settlement ledger.
create table if not exists public.walmart_fee_assumptions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 data jsonb not null,
 primary key(owner_id,sku)
);
alter table public.walmart_fee_assumptions enable row level security;
drop policy if exists walmart_fee_assumptions_read on public.walmart_fee_assumptions;
create policy walmart_fee_assumptions_read on public.walmart_fee_assumptions for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_fee_assumptions to authenticated;
grant all on public.walmart_fee_assumptions to service_role;


-- SOURCE: walmart_return_recoveries.sql
-- Records owner-confirmed recoverable cost for returned goods. No stock, sales,
-- fee or original cost records are overwritten. Refunds themselves are read
-- from the Walmart Returns API and do not require this table to be created.
create table if not exists public.walmart_return_recoveries (
 owner_id uuid not null references auth.users(id) on delete cascade,
 return_id text not null,
 return_line_id text not null,
 quantity integer not null check(quantity>=0),
 unit_cost numeric(16,4) not null check(unit_cost>=0),
 confirmed_at timestamptz not null default now(),
 primary key(owner_id,return_id,return_line_id)
);
alter table public.walmart_return_recoveries enable row level security;
drop policy if exists walmart_return_recoveries_read on public.walmart_return_recoveries;
create policy walmart_return_recoveries_read on public.walmart_return_recoveries for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_return_recoveries to authenticated;
grant all on public.walmart_return_recoveries to service_role;


-- SOURCE: multiuser_foundation.sql
-- Invite-only first release. Run as postgres in Supabase SQL Editor.
-- Existing rows and legacy marketplace bindings are preserved.

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
