-- Soul Analytics product costs and TikTok settled order finance.
-- Execute each CREATE TABLE separately if SQL Editor rejects multiple statements.
create table if not exists public.tiktok_order_items (
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 order_id text not null,
 line_id text not null,
 sku_id text not null,
 product_id text,
 product_name text not null default 'Unnamed product',
 sku_name text,
 sku_image text,
 quantity integer not null default 1 check(quantity > 0),
 unit_sale_price numeric(16,2),
 currency text not null default 'USD',
 synced_at timestamptz not null default now(),
 primary key(owner_id,shop_id,order_id,line_id)
);

create table if not exists public.tiktok_product_costs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 sku_id text not null,
 unit_cogs numeric(16,2) not null check(unit_cogs >= 0),
 updated_at timestamptz not null default now(),
 primary key(owner_id,shop_id,sku_id)
);

create table if not exists public.tiktok_order_finance (
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 order_id text not null,
 currency text not null,
 revenue_amount numeric(16,2),
 fee_and_tax_amount numeric(16,2),
 shipping_cost_amount numeric(16,2),
 settlement_amount numeric(16,2),
 settled_at timestamptz not null default now(),
 primary key(owner_id,shop_id,order_id)
);

-- Run each line separately if your SQL Editor accepts only one statement.
alter table public.tiktok_order_items enable row level security;
alter table public.tiktok_product_costs enable row level security;
alter table public.tiktok_order_finance enable row level security;
-- No client-access policies: only authenticated owner-checked backend routes use service role.
