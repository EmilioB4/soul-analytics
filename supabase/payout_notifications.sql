-- Private server-only configuration and durable delivery history.
create table if not exists public.payout_alert_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 webhook_encrypted text not null,
 enabled boolean not null default false,
 tiktok_enabled boolean not null default true,
 walmart_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 last_checked_at timestamptz,
 last_error text,
 lock_token uuid,
 locked_until timestamptz
);
alter table public.payout_alert_settings enable row level security;
create table if not exists public.payout_alert_sources (
 owner_id uuid not null references public.payout_alert_settings(owner_id) on delete cascade,
 platform text not null check(platform in ('tiktok','walmart')),
 initialized_at timestamptz not null default now(),
 primary key(owner_id,platform)
);
alter table public.payout_alert_sources enable row level security;
create table if not exists public.payout_alert_events (
 owner_id uuid not null references public.payout_alert_settings(owner_id) on delete cascade,
 platform text not null check(platform in ('tiktok','walmart')),
 event_id text not null,
 stage text not null check(stage in ('processing','paid','scheduled')),
 state text not null check(state in ('baseline','sending','sent','retry','uncertain')),
 amount numeric(16,2) not null,
 event_date date not null,
 attempts integer not null default 0,
 retry_after timestamptz,
 message_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(owner_id,platform,event_id,stage)
);
alter table public.payout_alert_events enable row level security;
revoke all on public.payout_alert_settings,public.payout_alert_sources,public.payout_alert_events from anon,authenticated;
grant all on public.payout_alert_settings,public.payout_alert_sources,public.payout_alert_events to service_role;
-- Claim the whole check, including initial baselines, atomically across cron/manual requests.
create or replace function public.claim_payout_alert_check(p_owner uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update payout_alert_settings set lock_token=p_token,locked_until=now()+interval '5 minutes'
 where owner_id=p_owner and enabled and (locked_until is null or locked_until<now());
 return found;
end;
$$;
revoke all on function public.claim_payout_alert_check(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_payout_alert_check(uuid,uuid) to service_role;
