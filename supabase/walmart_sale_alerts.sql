-- Run once in the testing project SQL Editor, after walmart_test_setup.sql.
-- Private per-user sale preferences and a durable, deduplicated outbox.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
create table if not exists public.walmart_sale_alert_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 webhook_encrypted text not null,
 enabled_at timestamptz not null default now(),
 initialized_at timestamptz,
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 lock_token uuid,
 locked_until timestamptz
);
create table if not exists public.walmart_sale_alert_events (
 owner_id uuid not null references auth.users(id) on delete cascade,
 order_id text not null,
 line_id text not null,
 payload jsonb not null,
 state text not null check(state in ('baseline','pending','sending','sent','uncertain')),
 attempts integer not null default 0,
 retry_at timestamptz,
 message_id text,
 updated_at timestamptz not null default now(),
 primary key(owner_id,order_id,line_id)
);
create index if not exists walmart_sales_pending_idx on public.walmart_sale_alert_events(owner_id,state,retry_at);
create table if not exists public.walmart_sale_alert_dispatches(request_id bigint primary key,created_at timestamptz not null default now());
alter table public.walmart_sale_alert_settings enable row level security;
alter table public.walmart_sale_alert_events enable row level security;
alter table public.walmart_sale_alert_dispatches enable row level security;
revoke all on public.walmart_sale_alert_settings,public.walmart_sale_alert_events,public.walmart_sale_alert_dispatches from public,anon,authenticated;
grant all on public.walmart_sale_alert_settings,public.walmart_sale_alert_events,public.walmart_sale_alert_dispatches to service_role;
create or replace function public.save_walmart_sale_alerts(p_owner uuid,p_webhook text,p_enabled boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous public.walmart_sale_alert_settings;
begin
 if not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Account not admitted';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':sale-settings',0));
 select * into previous from walmart_sale_alert_settings where owner_id=p_owner for update;
 insert into walmart_sale_alert_settings(owner_id,webhook_encrypted,enabled) values(p_owner,p_webhook,p_enabled)
 on conflict(owner_id) do update set webhook_encrypted=excluded.webhook_encrypted,enabled=excluded.enabled,
 enabled_at=case when excluded.enabled and not walmart_sale_alert_settings.enabled then now() else walmart_sale_alert_settings.enabled_at end,
 initialized_at=case when excluded.enabled and not walmart_sale_alert_settings.enabled then null else walmart_sale_alert_settings.initialized_at end,
 lock_token=null,locked_until=null;
 if p_enabled and not coalesce(previous.enabled,false) then update walmart_sale_alert_events set state='baseline',updated_at=now() where owner_id=p_owner and state='pending';end if;
end $$;
create or replace function public.claim_walmart_sale_check(p_owner uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update walmart_sale_alert_settings set lock_token=p_token,locked_until=now()+interval '2 minutes',last_attempt_at=now()
 where owner_id=p_owner and enabled and (locked_until is null or locked_until<now())
 and (last_attempt_at is null or last_attempt_at<now()-interval '50 seconds')
 and exists(select 1 from profiles where user_id=p_owner);
 return found;
end $$;
create or replace function public.record_walmart_sale_events(p_owner uuid,p_token uuid,p_rows jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare settings public.walmart_sale_alert_settings; item jsonb;
begin
 select * into settings from walmart_sale_alert_settings where owner_id=p_owner and enabled and lock_token=p_token and locked_until>now() for update;
 if not found then raise exception 'Sale check lease expired';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000 then raise exception 'Invalid sale event batch';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if length(item->>'order_id')<1 or length(item->>'line_id')<1 or (item->>'quantity')::numeric<=0 then raise exception 'Invalid sale line';end if;
  insert into walmart_sale_alert_events(owner_id,order_id,line_id,payload,state)
  values(p_owner,item->>'order_id',item->>'line_id',item,
   case when nullif(item->>'sold_at','')::timestamptz>=settings.enabled_at then 'pending' else 'baseline' end)
  on conflict(owner_id,order_id,line_id) do nothing;
 end loop;
 update walmart_sale_alert_settings set initialized_at=coalesce(initialized_at,now()),last_success_at=now(),last_error=null where owner_id=p_owner and lock_token=p_token;
end $$;
create or replace function public.claim_walmart_sale_delivery(p_owner uuid,p_token uuid) returns setof public.walmart_sale_alert_events
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from walmart_sale_alert_settings where owner_id=p_owner and enabled and lock_token=p_token and locked_until>now()) or not exists(select 1 from profiles where user_id=p_owner) then return;end if;
 -- Never blindly resend after a killed process may have reached Discord.
 update walmart_sale_alert_events set state='uncertain',updated_at=now() where owner_id=p_owner and state='sending' and updated_at<now()-interval '3 minutes';
 return query update walmart_sale_alert_events set state='sending',attempts=attempts+1,updated_at=now()
 where (owner_id,order_id,line_id) in (select owner_id,order_id,line_id from walmart_sale_alert_events where owner_id=p_owner and state='pending' and (retry_at is null or retry_at<=now()) order by updated_at for update skip locked limit 1)
 returning *;
end $$;
create or replace function public.invoke_walmart_sale_alerts() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare target text;secret text;bypass text;request bigint;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='soul_sales_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='soul_sales_secret';
 select decrypted_secret into bypass from vault.decrypted_secrets where name='soul_sales_bypass';
 if target is null or secret is null then raise exception 'Sale scheduler not configured';end if;
 request:=net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||secret)||case when bypass is not null then jsonb_build_object('x-vercel-protection-bypass',bypass) else '{}'::jsonb end,timeout_milliseconds:=55000);
 insert into walmart_sale_alert_dispatches(request_id) values(request);
 delete from walmart_sale_alert_dispatches where created_at<now()-interval '2 days';
 return request;
end $$;
create or replace function public.configure_walmart_sale_alerts(p_origin text,p_secret text,p_bypass text default null) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare pair record;existing uuid;job bigint;
begin
 if p_origin is null or p_origin !~ '^https://[a-zA-Z0-9.-]+$' or p_secret is null or length(p_secret)<16 then raise exception 'Invalid scheduler configuration';end if;
 perform pg_advisory_xact_lock(hashtextextended('soul:walmart-sales-config',0));
 for pair in select * from (values ('soul_sales_url',p_origin||'/api/notifications/sales/cron'),('soul_sales_secret',p_secret),('soul_sales_bypass',p_bypass)) as x(name,value) loop
  select id into existing from vault.secrets where name=pair.name;
  if existing is not null and pair.value is null then delete from vault.secrets where id=existing;
  elsif existing is null and pair.value is not null then perform vault.create_secret(pair.value,pair.name);
  elsif pair.value is not null then perform vault.update_secret(existing,pair.value);end if;
 end loop;
 select cron.schedule('soul-walmart-sales-minute','* * * * *','select public.invoke_walmart_sale_alerts();') into job;
 return job;
end $$;
create or replace function public.walmart_sale_schedule_status() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare response record;queued timestamptz;
begin
 select max(created_at) into queued from walmart_sale_alert_dispatches;
 select r.status_code,r.created,r.timed_out into response from net._http_response r join walmart_sale_alert_dispatches d on d.request_id=r.id order by d.created_at desc limit 1;
 return jsonb_build_object('scheduled',exists(select 1 from cron.job where jobname='soul-walmart-sales-minute' and active),'queuedAt',queued,'responseAt',response.created,'httpStatus',response.status_code,'timedOut',response.timed_out);
end $$;
revoke all on function public.save_walmart_sale_alerts(uuid,text,boolean),public.claim_walmart_sale_check(uuid,uuid),public.record_walmart_sale_events(uuid,uuid,jsonb),public.claim_walmart_sale_delivery(uuid,uuid),public.invoke_walmart_sale_alerts(),public.configure_walmart_sale_alerts(text,text,text),public.walmart_sale_schedule_status() from public,anon,authenticated;
grant execute on function public.save_walmart_sale_alerts(uuid,text,boolean),public.claim_walmart_sale_check(uuid,uuid),public.record_walmart_sale_events(uuid,uuid,jsonb),public.claim_walmart_sale_delivery(uuid,uuid),public.invoke_walmart_sale_alerts(),public.configure_walmart_sale_alerts(text,text,text),public.walmart_sale_schedule_status() to service_role;
notify pgrst,'reload schema';
commit;
