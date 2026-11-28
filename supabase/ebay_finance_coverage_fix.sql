-- Run once in the existing site's Supabase SQL Editor. Preserves orders, costs and transactions.
begin;
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
revoke all on function public.save_ebay_finances(uuid,text,uuid,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.save_ebay_finances(uuid,text,uuid,timestamptz,timestamptz,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
