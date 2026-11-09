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
