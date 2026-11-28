-- Run after ebay_setup.sql AND ebay_account_deletion.sql. Private eBay data only.
begin;
alter table public.ebay_orders add column if not exists shipping_mode text check(shipping_mode in ('ebay','manual'));
alter table public.ebay_orders add column if not exists packaging_cost numeric check(packaging_cost>=0);
create table if not exists public.ebay_transactions(
 owner_id uuid not null references auth.users(id) on delete cascade,account_id text not null,
 transaction_type text not null,transaction_id text not null,transaction_date timestamptz not null,data jsonb not null,
 primary key(owner_id,account_id,transaction_type,transaction_id)
);
create table if not exists public.ebay_finance_syncs(
 owner_id uuid not null references auth.users(id) on delete cascade,account_id text not null,
 start_at timestamptz not null,end_at timestamptz not null,synced_at timestamptz not null default now(),
 primary key(owner_id,account_id)
);
alter table public.ebay_transactions enable row level security;
alter table public.ebay_finance_syncs enable row level security;
revoke all on public.ebay_transactions,public.ebay_finance_syncs from public,anon,authenticated;
grant all on public.ebay_transactions,public.ebay_finance_syncs to service_role;
drop trigger if exists ebay_deleted_account_guard on public.ebay_transactions;
create trigger ebay_deleted_account_guard before insert or update on public.ebay_transactions for each row execute function public.guard_deleted_ebay_account();
drop trigger if exists ebay_deleted_account_guard on public.ebay_finance_syncs;
create trigger ebay_deleted_account_guard before insert or update on public.ebay_finance_syncs for each row execute function public.guard_deleted_ebay_account();
create or replace function public.save_ebay_finances(p_owner uuid,p_account text,p_token uuid,p_start timestamptz,p_end timestamptz,p_rows jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 perform 1 from ebay_connections where owner_id=p_owner and account_id=p_account and sync_lock=p_token and sync_locked_until>now() for update;
 if not found or not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Connection lease expired';end if;
 if p_start is null or p_end is null or p_start>p_end or p_end-p_start>interval '370 days' or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>4000 then raise exception 'Invalid financial batch';end if;
 delete from ebay_transactions where owner_id=p_owner and account_id=p_account and transaction_date between p_start and p_end;
 for r in select value from jsonb_array_elements(p_rows) loop
  if coalesce(r->>'id','')='' or coalesce(r->>'type','')='' or (r->>'date')::timestamptz not between p_start and p_end or (r->>'date') is null then raise exception 'Invalid transaction';end if;
  insert into ebay_transactions(owner_id,account_id,transaction_type,transaction_id,transaction_date,data) values(p_owner,p_account,r->>'type',r->>'id',(r->>'date')::timestamptz,r);
 end loop;
 insert into ebay_finance_syncs(owner_id,account_id,start_at,end_at) values(p_owner,p_account,p_start,p_end)
 on conflict(owner_id,account_id) do update set
  start_at=case when ebay_finance_syncs.end_at>=excluded.start_at and excluded.end_at>=ebay_finance_syncs.start_at
    then least(ebay_finance_syncs.start_at,excluded.start_at) else excluded.start_at end,
  end_at=case when ebay_finance_syncs.end_at>=excluded.start_at and excluded.end_at>=ebay_finance_syncs.start_at
    then greatest(ebay_finance_syncs.end_at,excluded.end_at) else excluded.end_at end,
  synced_at=now();
 update ebay_connections set sync_lock=null,sync_locked_until=null where owner_id=p_owner and sync_lock=p_token;
end $$;
-- Replace deletion transaction to cover the new financial storage too.
create or replace function public.delete_ebay_account_data(p_account text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_account is null or length(btrim(p_account))=0 or length(p_account)>512 then raise exception 'Invalid eBay account';end if;
 perform pg_advisory_xact_lock(hashtextextended('ebay-deletion:'||p_account,0));
 insert into ebay_deleted_accounts(account_hash) values(encode(sha256(convert_to(p_account,'UTF8')),'hex')) on conflict do nothing;
 delete from ebay_oauth_states where owner_id in(select owner_id from ebay_connections where account_id=p_account);
 delete from ebay_connections where account_id=p_account;
 delete from ebay_orders where account_id=p_account;
 delete from ebay_product_costs where account_id=p_account;
 delete from ebay_transactions where account_id=p_account;
 delete from ebay_finance_syncs where account_id=p_account;
end $$;
revoke all on function public.save_ebay_finances(uuid,text,uuid,timestamptz,timestamptz,jsonb),public.delete_ebay_account_data(text) from public,anon,authenticated;
grant execute on function public.save_ebay_finances(uuid,text,uuid,timestamptz,timestamptz,jsonb),public.delete_ebay_account_data(text) to service_role;
notify pgrst,'reload schema';
commit;
