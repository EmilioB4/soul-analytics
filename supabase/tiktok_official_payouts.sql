-- TikTok's estimated unsettled settlements and official payment records.
-- All rows are private: owner-checked server routes use a service-role connection.
create table if not exists public.tiktok_unsettled_transactions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 transaction_id text not null,
 order_id text,
 type text not null,
 currency text not null,
 order_created_at timestamptz,
 estimated_amount numeric(16,2),
 fee_amount numeric(16,2),
 shipping_amount numeric(16,2),
 estimated_settlement text,
 synced_at timestamptz not null default now(),
 primary key(owner_id,shop_id,transaction_id)
);
create index if not exists idx_soul_unsettled_dates on public.tiktok_unsettled_transactions(owner_id,shop_id,order_created_at);
alter table public.tiktok_unsettled_transactions enable row level security;

create table if not exists public.tiktok_payment_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 shop_id text not null,
 payment_id text not null,
 status text not null,
 currency text not null,
 amount numeric(16,2) not null,
 settlement_amount numeric(16,2),
 created_at timestamptz not null,
 paid_at timestamptz,
 bank_last_four text,
 synced_at timestamptz not null default now(),
 primary key(owner_id,shop_id,payment_id)
);
create index if not exists idx_soul_payments_dates on public.tiktok_payment_records(owner_id,shop_id,created_at);
alter table public.tiktok_payment_records enable row level security;
