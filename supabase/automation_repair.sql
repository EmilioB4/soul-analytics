-- Run this complete repair once in Supabase SQL Editor. It is safe to rerun.
-- Keeps saved webhooks, preferences, order records and delivery history.

-- payout_notifications.sql
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


-- payout_notifications_fast.sql
-- Optional fast scheduler. Install payout_notifications.sql first.
-- Hosted Supabase supports these extensions; no webhook or cron secret goes in this file.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.invoke_payout_alert_check()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare target text; token text;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='soul_payout_cron_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='soul_payout_cron_secret';
 if target is null or token is null then raise exception 'Payout scheduler secrets are missing'; end if;
 return net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=55000);
end;
$$;
revoke all on function public.invoke_payout_alert_check() from public,anon,authenticated;
grant execute on function public.invoke_payout_alert_check() to service_role;

create or replace function public.configure_payout_alert_schedule(p_url text,p_secret text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_id uuid; job_id bigint;
begin
 if p_url !~ '^https://[a-zA-Z0-9.-]+/api/notifications/payouts/cron$' or length(p_secret)<16 then
  raise exception 'Invalid scheduler configuration';
 end if;
 select id into secret_id from vault.secrets where name='soul_payout_cron_url';
 if secret_id is null then perform vault.create_secret(p_url,'soul_payout_cron_url');
 else perform vault.update_secret(secret_id,p_url); end if;
 select id into secret_id from vault.secrets where name='soul_payout_cron_secret';
 if secret_id is null then perform vault.create_secret(p_secret,'soul_payout_cron_secret');
 else perform vault.update_secret(secret_id,p_secret); end if;
 select cron.schedule('soul-payout-alerts-minute','* * * * *','select public.invoke_payout_alert_check();') into job_id;
 return job_id;
end;
$$;
revoke all on function public.configure_payout_alert_schedule(text,text) from public,anon,authenticated;
grant execute on function public.configure_payout_alert_schedule(text,text) to service_role;

create or replace function public.payout_alert_schedule_status()
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from cron.job where jobname='soul-payout-alerts-minute' and active and schedule='* * * * *');
$$;
revoke all on function public.payout_alert_schedule_status() from public,anon,authenticated;
grant execute on function public.payout_alert_schedule_status() to service_role;

-- Optional in-app binding is allowed by the server only for a sole approved workspace owner.
create table if not exists public.payout_platform_owners (
 platform text primary key check(platform='walmart'),
 owner_id uuid not null references auth.users(id) on delete cascade
);
alter table public.payout_platform_owners enable row level security;
revoke all on public.payout_platform_owners from anon,authenticated;
grant all on public.payout_platform_owners to service_role;


-- order_auto_sync.sql
-- Automatic order imports. Private server-only tables/functions.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
create table if not exists public.order_auto_syncs (
 owner_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('tiktok','walmart','whatnot')),
 enabled boolean not null default false,
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 last_count integer,
 lock_token uuid,
 locked_until timestamptz,
 primary key(owner_id,platform)
);
alter table public.order_auto_syncs enable row level security;
revoke all on public.order_auto_syncs from anon,authenticated;
grant all on public.order_auto_syncs to service_role;
create or replace function public.claim_order_auto_sync(p_owner uuid,p_platform text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update order_auto_syncs set lock_token=p_token,locked_until=now()+interval '3 minutes',last_attempt_at=now()
 where owner_id=p_owner and platform=p_platform and enabled
 and (locked_until is null or locked_until<now())
 and (last_attempt_at is null or last_attempt_at<now()-interval '4 minutes');
 return found;
end;
$$;
revoke all on function public.claim_order_auto_sync(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_order_auto_sync(uuid,text,uuid) to service_role;
create or replace function public.invoke_order_auto_sync()
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare target text; token text;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='soul_orders_cron_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='soul_orders_cron_secret';
 if target is null or token is null then raise exception 'Order scheduler configuration missing';end if;
 return net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=55000);
end;
$$;
revoke all on function public.invoke_order_auto_sync() from public,anon,authenticated;
grant execute on function public.invoke_order_auto_sync() to service_role;
create or replace function public.configure_order_auto_sync(p_url text,p_secret text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_id uuid; job_id bigint;
begin
 if p_url !~ '^https://[a-zA-Z0-9.-]+/api/orders/auto-sync/cron$' or length(p_secret)<16 then raise exception 'Invalid order scheduler configuration';end if;
 select id into secret_id from vault.secrets where name='soul_orders_cron_url';
 if secret_id is null then perform vault.create_secret(p_url,'soul_orders_cron_url');else perform vault.update_secret(secret_id,p_url);end if;
 select id into secret_id from vault.secrets where name='soul_orders_cron_secret';
 if secret_id is null then perform vault.create_secret(p_secret,'soul_orders_cron_secret');else perform vault.update_secret(secret_id,p_secret);end if;
 select cron.schedule('soul-orders-five-minutes','*/5 * * * *','select public.invoke_order_auto_sync();') into job_id;
 return job_id;
end;
$$;
revoke all on function public.configure_order_auto_sync(text,text) from public,anon,authenticated;
grant execute on function public.configure_order_auto_sync(text,text) to service_role;
create or replace function public.order_auto_sync_status()
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from cron.job where jobname='soul-orders-five-minutes' and active and schedule='*/5 * * * *');
$$;
revoke all on function public.order_auto_sync_status() from public,anon,authenticated;
grant execute on function public.order_auto_sync_status() to service_role;


-- Record real background HTTP requests so manual checks cannot masquerade as a healthy scheduler.
create table if not exists public.automation_requests (
 request_id bigint primary key,
 kind text not null check(kind in ('orders','payouts')),
 created_at timestamptz not null default now()
);
create index if not exists automation_requests_kind_time on public.automation_requests(kind,created_at desc);
alter table public.automation_requests enable row level security;
revoke all on public.automation_requests from anon,authenticated;
grant all on public.automation_requests to service_role;

create or replace function public.configure_background_automation(p_origin text,p_secret text,p_bypass text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_id uuid;
begin
 if p_origin is null or p_secret is null or p_origin !~ '^https://[a-zA-Z0-9.-]+$' or length(p_secret)<16 then raise exception 'Invalid background automation configuration';end if;
 perform public.configure_order_auto_sync(p_origin||'/api/orders/auto-sync/cron',p_secret);
 perform public.configure_payout_alert_schedule(p_origin||'/api/notifications/payouts/cron',p_secret);
 if p_bypass is not null and length(p_bypass)>0 then
  select id into secret_id from vault.secrets where name='soul_automation_bypass';
  if secret_id is null then perform vault.create_secret(p_bypass,'soul_automation_bypass');else perform vault.update_secret(secret_id,p_bypass);end if;
 end if;
end;
$$;
revoke all on function public.configure_background_automation(text,text,text) from public,anon,authenticated;
grant execute on function public.configure_background_automation(text,text,text) to service_role;

create or replace function public.dispatch_automation_request(p_kind text)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare target text; token text; bypass text; headers jsonb; queued_id bigint;
begin
 if p_kind not in ('orders','payouts') then raise exception 'Invalid automation kind';end if;
 select decrypted_secret into target from vault.decrypted_secrets where name=case when p_kind='orders' then 'soul_orders_cron_url' else 'soul_payout_cron_url' end;
 select decrypted_secret into token from vault.decrypted_secrets where name=case when p_kind='orders' then 'soul_orders_cron_secret' else 'soul_payout_cron_secret' end;
 select decrypted_secret into bypass from vault.decrypted_secrets where name='soul_automation_bypass';
 if target is null or token is null then raise exception 'Background automation has not been configured';end if;
 headers:=jsonb_build_object('Authorization','Bearer '||token);
 if bypass is not null then headers:=headers||jsonb_build_object('x-vercel-protection-bypass',bypass);end if;
 queued_id:=net.http_get(url:=target,headers:=headers,timeout_milliseconds:=55000);
 insert into public.automation_requests(request_id,kind) values(queued_id,p_kind);
 delete from public.automation_requests where created_at<now()-interval '2 days';
 return queued_id;
end;
$$;
revoke all on function public.dispatch_automation_request(text) from public,anon,authenticated;
grant execute on function public.dispatch_automation_request(text) to service_role;
create or replace function public.invoke_order_auto_sync()
returns bigint language sql security definer set search_path=public,pg_temp as $$ select public.dispatch_automation_request('orders'); $$;
create or replace function public.invoke_payout_alert_check()
returns bigint language sql security definer set search_path=public,pg_temp as $$ select public.dispatch_automation_request('payouts'); $$;
revoke all on function public.invoke_order_auto_sync(),public.invoke_payout_alert_check() from public,anon,authenticated;
grant execute on function public.invoke_order_auto_sync(),public.invoke_payout_alert_check() to service_role;

create or replace function public.automation_scheduler_health()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job_kind text; scheduled boolean; queued_at timestamptz; response_at timestamptz; code integer;
 timed_out boolean; response_error text; content text; body jsonb; health text; result jsonb:='{}'::jsonb;
begin
 foreach job_kind in array array['orders','payouts'] loop
  select coalesce(bool_or(active),false) into scheduled from cron.job where jobname=case when job_kind='orders' then 'soul-orders-five-minutes' else 'soul-payout-alerts-minute' end;
  select a.created_at into queued_at from public.automation_requests a where a.kind=job_kind order by a.created_at desc,a.request_id desc limit 1;
  select r.created,r.status_code,r.timed_out,r.error_msg,r.content into response_at,code,timed_out,response_error,content
   from public.automation_requests a join net._http_response r on r.id=a.request_id where a.kind=job_kind order by a.created_at desc,a.request_id desc limit 1;
  health:='ok';body:=null;
  if not scheduled then health:='off';
  elsif queued_at is null then health:='waiting';
  elsif response_at is null then health:=case when queued_at<now()-interval '2 minutes' then 'no_response' else 'queued' end;
  elsif timed_out then health:='timed_out';
  elsif response_error is not null then health:='failed';
  elsif code=401 then health:='unauthorized';
  elsif code=403 then health:='blocked';
  elsif code between 300 and 399 then health:='redirect';
  elsif code=404 then health:='not_found';
  elsif code is null or code not between 200 and 299 then health:='server_error';
  elsif response_at<now()-(case when job_kind='orders' then interval '15 minutes' else interval '3 minutes' end) then health:='stale';
  else
   begin body:=content::jsonb;exception when others then body:=null;end;
   if body is null or jsonb_typeof(body->'results') is distinct from 'array' then health:='invalid_response';
   elsif jsonb_path_exists(body,'$.results[*].error') or jsonb_path_exists(body,'$.results[*].errors[*]') then health:='provider_error';end if;
  end if;
  result:=result||jsonb_build_object(job_kind,jsonb_build_object('state',health,'scheduled',scheduled,'queuedAt',queued_at,'responseAt',response_at,'httpStatus',code));
 end loop;
 return result;
end;
$$;
revoke all on function public.automation_scheduler_health() from public,anon,authenticated;
grant execute on function public.automation_scheduler_health() to service_role;
notify pgrst, 'reload schema';
