-- Run this migration once in Supabase SQL Editor (Database, not Logs).
-- Tokens are encrypted by the server BEFORE being stored. Never insert secrets manually.
create table if not exists public.plaid_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 item_id text not null,
 access_token_encrypted text not null,
 account_id text,
 account_name text,
 account_mask text,
 cursor text,
 updated_at timestamptz not null default now()
);
alter table public.plaid_connections enable row level security;

create table if not exists public.plaid_bank_transactions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 transaction_id text not null,
 account_id text not null,
 date date not null,
 name text not null,
 amount numeric(16,2) not null,
 currency text not null,
 pending boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(owner_id,transaction_id)
);
alter table public.plaid_bank_transactions enable row level security;
create index if not exists idx_plaid_bank_transactions_owner_date on public.plaid_bank_transactions(owner_id,date desc);
-- No public/anon/authenticated RLS policies: owner-checked server routes use the service role.
