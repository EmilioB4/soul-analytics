-- Run in Supabase SQL Editor before enabling a completed TikTok token exchange.
-- Never expose tokens via public client queries.
create table if not exists public.tiktok_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null,
  connected_at timestamptz not null default now(),
  unique(user_id,shop_id)
);
alter table public.tiktok_connections enable row level security;
-- No public policies: server-side service-role access only.
