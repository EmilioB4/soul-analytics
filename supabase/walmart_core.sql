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
