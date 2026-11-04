-- Execute in Supabase SQL Editor as a NORMAL SQL snippet (not Logs).
-- Run this CREATE TABLE statement first.
create table if not exists public.tiktok_orders (
  owner_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null,
  order_id text not null,
  status text not null,
  created_at timestamptz,
  updated_at timestamptz,
  currency text not null default 'USD',
  product_subtotal numeric(16,2),
  buyer_paid_total numeric(16,2),
  synced_at timestamptz not null default now(),
  primary key(owner_id,shop_id,order_id)
);

-- Then run this ALTER statement separately if the editor only allows one query.
alter table public.tiktok_orders enable row level security;
-- Do not create client SELECT/INSERT/UPDATE policies here. Access is only through
-- owner-authenticated server routes using the service-role key.
