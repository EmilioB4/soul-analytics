-- Run in Supabase SQL Editor before opening the Walmart tab.
-- The signed fee amount is positive for expenses, negative for credits.
create table if not exists public.walmart_sales (
 owner_id uuid not null references auth.users(id) on delete cascade,
 order_id text not null,
 line_id text not null,
 order_date date not null,
 sku text not null,
 product_name text not null,
 fulfillment text not null check (fulfillment in ('WFS','SF','Unknown')),
 quantity integer not null check(quantity > 0),
 revenue numeric(16,2) not null,
 primary key (owner_id,order_id,line_id)
);
create table if not exists public.walmart_fees (
 owner_id uuid not null references auth.users(id) on delete cascade,
 transaction_id text not null,
 fee_date date not null,
 sku text,
 order_id text,
 fee_type text not null,
 amount numeric(16,2) not null,
 primary key (owner_id,transaction_id)
);
create table if not exists public.walmart_product_costs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 unit_cogs numeric(16,2) not null check(unit_cogs>=0),
 primary key (owner_id,sku)
);
alter table public.walmart_sales enable row level security;
alter table public.walmart_fees enable row level security;
alter table public.walmart_product_costs enable row level security;
create policy "owner walmart sales" on public.walmart_sales for all to authenticated using (owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "owner walmart fees" on public.walmart_fees for all to authenticated using (owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "owner walmart costs" on public.walmart_product_costs for all to authenticated using (owner_id=auth.uid()) with check(owner_id=auth.uid());
