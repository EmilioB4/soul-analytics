create table if not exists public.tiktok_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 open_id text not null,
 access_token_encrypted text not null,
 refresh_token_encrypted text not null,
 access_expires_at timestamptz,
 refresh_expires_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.tiktok_connections enable row level security;
-- No client-side policies: service-role server routes only.
