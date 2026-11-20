-- Run AFTER ebay_setup.sql. Only eBay data is affected.
begin;
-- One-way account fingerprints prevent replayed OAuth/cost/sync writes restoring data.
create table if not exists public.ebay_deleted_accounts(account_hash text primary key);
alter table public.ebay_deleted_accounts enable row level security;
revoke all on public.ebay_deleted_accounts from public,anon,authenticated;
grant all on public.ebay_deleted_accounts to service_role;
create or replace function public.guard_deleted_ebay_account() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ebay-deletion:'||new.account_id,0));
 if exists(select 1 from ebay_deleted_accounts where account_hash=encode(sha256(convert_to(new.account_id,'UTF8')),'hex')) then
  raise exception 'eBay account data has been deleted';
 end if;
 return new;
end $$;
drop trigger if exists ebay_deleted_account_guard on public.ebay_connections;
create trigger ebay_deleted_account_guard before insert or update on public.ebay_connections for each row execute function public.guard_deleted_ebay_account();
drop trigger if exists ebay_deleted_account_guard on public.ebay_orders;
create trigger ebay_deleted_account_guard before insert or update on public.ebay_orders for each row execute function public.guard_deleted_ebay_account();
drop trigger if exists ebay_deleted_account_guard on public.ebay_product_costs;
create trigger ebay_deleted_account_guard before insert or update on public.ebay_product_costs for each row execute function public.guard_deleted_ebay_account();
create or replace function public.delete_ebay_account_data(p_account text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_account is null or length(btrim(p_account))=0 or length(p_account)>512 then raise exception 'Invalid eBay account';end if;
 perform pg_advisory_xact_lock(hashtextextended('ebay-deletion:'||p_account,0));
 insert into ebay_deleted_accounts(account_hash) values(encode(sha256(convert_to(p_account,'UTF8')),'hex')) on conflict do nothing;
 -- Remove pending authorizations only for owners currently connected to this seller.
 delete from ebay_oauth_states where owner_id in(select owner_id from ebay_connections where account_id=p_account);
 delete from ebay_connections where account_id=p_account;
 -- Also covers retained history for sellers disconnected before the notice arrived.
 delete from ebay_orders where account_id=p_account;
 delete from ebay_product_costs where account_id=p_account;
end $$;
revoke all on function public.guard_deleted_ebay_account(),public.delete_ebay_account_data(text) from public,anon,authenticated;
grant execute on function public.delete_ebay_account_data(text) to service_role;
notify pgrst,'reload schema';
commit;
