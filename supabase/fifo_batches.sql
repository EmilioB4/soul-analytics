-- Soul Analytics FIFO inventory lots. Execute CREATE and ALTER separately if required.
create table if not exists public.tiktok_inventory_batches (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 sku_id text not null,
 acquired_on date not null,
 quantity integer not null check(quantity > 0),
 unit_cost numeric(16,2) not null check(unit_cost >= 0),
 note text not null default '',
 created_at timestamptz not null default now()
);

create index if not exists idx_tiktok_inventory_owner_sku on public.tiktok_inventory_batches(owner_id,shop_id,sku_id,acquired_on,id);

alter table public.tiktok_inventory_batches enable row level security;
-- No public RLS policies. Only owner-checked backend using service role can access batches.
