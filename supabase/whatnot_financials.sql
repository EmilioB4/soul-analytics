-- Run once in Supabase SQL Editor. Server API writes via service role; authenticated users have no direct access.
create table if not exists public.whatnot_report_runs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 report_id text not null,
 start_at timestamptz not null,
 end_at timestamptz not null,
 status text not null default 'pending',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 imported_at timestamptz,
 primary key(owner_id,report_id)
);
create unique index if not exists whatnot_report_window_uq on public.whatnot_report_runs(owner_id,start_at,end_at);
create table if not exists public.whatnot_ledger (
 owner_id uuid not null references auth.users(id) on delete cascade,
 ledger_transaction_id text not null,
 completed_at timestamptz,
 order_id text,
 livestream_id text,
 livestream_title text,
 transaction_type text not null,
 currency text not null,
 amount numeric(16,2) not null,
 sale_price numeric(16,2),
 commission_fee numeric(16,2),
 processing_fee numeric(16,2),
 commission_tax numeric(16,2),
 processing_tax numeric(16,2),
 seller_shipping numeric(16,2),
 import_report_id text not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,ledger_transaction_id)
);
create index if not exists whatnot_ledger_show_idx on public.whatnot_ledger(owner_id,livestream_id);
create index if not exists whatnot_ledger_date_idx on public.whatnot_ledger(owner_id,completed_at);
create table if not exists public.whatnot_stream_cogs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 livestream_id text not null,
 livestream_title text,
 total_cogs numeric(16,2) not null check(total_cogs >= 0),
 updated_at timestamptz not null default now(),
 primary key(owner_id,livestream_id)
);
alter table public.whatnot_report_runs enable row level security;
alter table public.whatnot_ledger enable row level security;
alter table public.whatnot_stream_cogs enable row level security;
-- No direct public or authenticated policies: all reads/writes pass through authenticated owner API routes.
