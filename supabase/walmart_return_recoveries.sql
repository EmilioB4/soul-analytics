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
