-- Run once in the Supabase project used by this deployment. Does not alter other platforms.
begin;
create table if not exists public.ebay_connections(
 owner_id uuid primary key references auth.users(id) on delete cascade,account_id text not null,username text not null,
 access_token_encrypted text not null,refresh_token_encrypted text not null,access_expires_at timestamptz not null,refresh_expires_at timestamptz not null,
 version uuid not null default gen_random_uuid(),connected_at timestamptz not null default now(),last_sync_at timestamptz,
 refresh_lock uuid,refresh_locked_until timestamptz,sync_lock uuid,sync_locked_until timestamptz
);
create table if not exists public.ebay_oauth_states(state_hash text primary key,owner_id uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null);
create table if not exists public.ebay_orders(
 owner_id uuid not null references auth.users(id) on delete cascade,account_id text not null,order_id text not null,
 created_at timestamptz not null,data jsonb not null,shipping_cost numeric check(shipping_cost>=0),primary key(owner_id,account_id,order_id)
);
create table if not exists public.ebay_product_costs(
 owner_id uuid not null references auth.users(id) on delete cascade,account_id text not null,sku text not null,unit_cost numeric not null check(unit_cost>=0),primary key(owner_id,account_id,sku)
);
alter table public.ebay_connections enable row level security;
alter table public.ebay_oauth_states enable row level security;
alter table public.ebay_orders enable row level security;
alter table public.ebay_product_costs enable row level security;
revoke all on public.ebay_connections,public.ebay_oauth_states,public.ebay_orders,public.ebay_product_costs from public,anon,authenticated;
grant all on public.ebay_connections,public.ebay_oauth_states,public.ebay_orders,public.ebay_product_costs to service_role;
create or replace function public.consume_ebay_oauth_state(p_hash text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 delete from ebay_oauth_states s where s.state_hash=p_hash and s.expires_at>now() and exists(select 1 from profiles where user_id=s.owner_id) returning s.owner_id into result;
 delete from ebay_oauth_states where expires_at<now();
 return result;
end $$;
create or replace function public.save_ebay_connection(p_owner uuid,p_account text,p_username text,p_access text,p_refresh text,p_access_expiry timestamptz,p_refresh_expiry timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Account not admitted';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':ebay',0));
 if exists(select 1 from ebay_connections where owner_id=p_owner and account_id<>p_account) then raise exception 'Disconnect the current account before switching eBay sellers';end if;
 insert into ebay_connections(owner_id,account_id,username,access_token_encrypted,refresh_token_encrypted,access_expires_at,refresh_expires_at)
 values(p_owner,p_account,p_username,p_access,p_refresh,p_access_expiry,p_refresh_expiry)
 on conflict(owner_id) do update set username=excluded.username,access_token_encrypted=excluded.access_token_encrypted,refresh_token_encrypted=excluded.refresh_token_encrypted,access_expires_at=excluded.access_expires_at,refresh_expires_at=excluded.refresh_expires_at,version=gen_random_uuid(),refresh_lock=null,refresh_locked_until=null,sync_lock=null,sync_locked_until=null;
end $$;
create or replace function public.disconnect_ebay(p_owner uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':ebay',0));
 delete from ebay_oauth_states where owner_id=p_owner;delete from ebay_connections where owner_id=p_owner;
end $$;
create or replace function public.claim_ebay_refresh(p_owner uuid,p_version uuid,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update ebay_connections set refresh_lock=p_token,refresh_locked_until=now()+interval '1 minute'
 where owner_id=p_owner and version=p_version and (refresh_locked_until is null or refresh_locked_until<now()) and exists(select 1 from profiles where user_id=p_owner);
 return found;
end $$;
create or replace function public.claim_ebay_sync(p_owner uuid,p_account text,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update ebay_connections set sync_lock=p_token,sync_locked_until=now()+interval '1 minute'
 where owner_id=p_owner and account_id=p_account and (sync_locked_until is null or sync_locked_until<now()) and exists(select 1 from profiles where user_id=p_owner);
 return found;
end $$;
create or replace function public.save_ebay_orders(p_owner uuid,p_account text,p_token uuid,p_rows jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row jsonb;
begin
 perform 1 from ebay_connections where owner_id=p_owner and account_id=p_account and sync_lock=p_token and sync_locked_until>now() for update;
 if not found or not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Connection lease expired';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Invalid order batch';end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  if coalesce(row->>'id','')='' then raise exception 'Invalid order';end if;
  insert into ebay_orders(owner_id,account_id,order_id,created_at,data) values(p_owner,p_account,row->>'id',(row->>'createdAt')::timestamptz,row)
  on conflict(owner_id,account_id,order_id) do update set created_at=excluded.created_at,data=excluded.data;
 end loop;
 update ebay_connections set last_sync_at=now(),sync_lock=null,sync_locked_until=null where owner_id=p_owner and sync_lock=p_token;
end $$;
revoke all on function public.consume_ebay_oauth_state(text),public.save_ebay_connection(uuid,text,text,text,text,timestamptz,timestamptz),public.disconnect_ebay(uuid),public.claim_ebay_refresh(uuid,uuid,uuid),public.claim_ebay_sync(uuid,text,uuid),public.save_ebay_orders(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.consume_ebay_oauth_state(text),public.save_ebay_connection(uuid,text,text,text,text,timestamptz,timestamptz),public.disconnect_ebay(uuid),public.claim_ebay_refresh(uuid,uuid,uuid),public.claim_ebay_sync(uuid,text,uuid),public.save_ebay_orders(uuid,text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
