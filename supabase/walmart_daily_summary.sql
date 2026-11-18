-- Run once in the SAME Supabase project used by this deployment.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
create table if not exists public.walmart_daily_webhooks(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,use_sale_webhook boolean not null default true,
 webhook_encrypted text,start_day date not null default (now() at time zone 'America/New_York')::date,
 last_attempt_at timestamptz,last_error text
);
create table if not exists public.walmart_daily_summary_events(
 owner_id uuid not null references auth.users(id) on delete cascade,report_day date not null,
 state text not null check(state in ('building','sending','sent','retry','uncertain')),
 payload jsonb,attempts integer not null default 1,lock_token uuid,locked_until timestamptz,
 retry_at timestamptz,message_id text,last_error text,updated_at timestamptz not null default now(),
 primary key(owner_id,report_day)
);
create table if not exists public.walmart_daily_summary_dispatches(request_id bigint primary key,created_at timestamptz not null default now());
alter table public.walmart_daily_webhooks enable row level security;
alter table public.walmart_daily_summary_events enable row level security;
alter table public.walmart_daily_summary_dispatches enable row level security;
revoke all on public.walmart_daily_webhooks,public.walmart_daily_summary_events,public.walmart_daily_summary_dispatches from public,anon,authenticated;
grant all on public.walmart_daily_webhooks,public.walmart_daily_summary_events,public.walmart_daily_summary_dispatches to service_role;
create or replace function public.save_walmart_daily_webhook(p_owner uuid,p_enabled boolean,p_reuse boolean,p_webhook text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Account not admitted';end if;
 if p_enabled and not p_reuse and p_webhook is null then raise exception 'Webhook required';end if;
 insert into walmart_daily_webhooks(owner_id,enabled,use_sale_webhook,webhook_encrypted) values(p_owner,p_enabled,p_reuse,p_webhook)
 on conflict(owner_id) do update set enabled=excluded.enabled,use_sale_webhook=excluded.use_sale_webhook,webhook_encrypted=excluded.webhook_encrypted,
 start_day=case when excluded.enabled and not walmart_daily_webhooks.enabled then (now() at time zone 'America/New_York')::date else walmart_daily_webhooks.start_day end;
end $$;
create or replace function public.claim_walmart_daily_summary(p_owner uuid,p_day date,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare local_time timestamp:=now() at time zone 'America/New_York';due date;started date;
begin
 select start_day into started from walmart_daily_webhooks where owner_id=p_owner and enabled for update;
 if not found or not exists(select 1 from profiles where user_id=p_owner) then return false;end if;
 update walmart_daily_webhooks set last_attempt_at=now() where owner_id=p_owner;
 due:=case when local_time::time>=time '23:59' then local_time::date else local_time::date-1 end;
 if p_day<>due or p_day<started then return false;end if;
 update walmart_daily_summary_events set state='uncertain',last_error='Delivery interrupted; check Discord before retrying.',updated_at=now()
 where owner_id=p_owner and report_day=p_day and state='sending' and locked_until<now();
 update walmart_daily_summary_events set state='uncertain',last_error='Retry limit reached.',updated_at=now()
 where owner_id=p_owner and report_day=p_day and state='retry' and attempts>=12;
 insert into walmart_daily_summary_events(owner_id,report_day,state,lock_token,locked_until)
 values(p_owner,p_day,'building',p_token,now()+interval '3 minutes')
 on conflict(owner_id,report_day) do update set state='building',lock_token=p_token,locked_until=now()+interval '3 minutes',attempts=walmart_daily_summary_events.attempts+1,updated_at=now()
 where (walmart_daily_summary_events.state='retry' and walmart_daily_summary_events.retry_at<=now())
 or (walmart_daily_summary_events.state='building' and walmart_daily_summary_events.locked_until<now());
 return found;
end $$;
create or replace function public.begin_walmart_daily_delivery(p_owner uuid,p_day date,p_token uuid,p_payload jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid summary';end if;
 if not exists(select 1 from walmart_daily_webhooks where owner_id=p_owner and enabled) or not exists(select 1 from profiles where user_id=p_owner) then return false;end if;
 update walmart_daily_summary_events set state='sending',payload=p_payload,updated_at=now()
 where owner_id=p_owner and report_day=p_day and state='building' and lock_token=p_token and locked_until>now();
 return found;
end $$;
create or replace function public.invoke_walmart_daily_summary() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare target text;secret text;bypass text;request bigint;
begin
 select decrypted_secret into target from vault.decrypted_secrets where name='soul_daily_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='soul_daily_secret';
 select decrypted_secret into bypass from vault.decrypted_secrets where name='soul_daily_bypass';
 if target is null or secret is null then raise exception 'Daily summary scheduler not configured';end if;
 request:=net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||secret)||case when bypass is not null then jsonb_build_object('x-vercel-protection-bypass',bypass) else '{}'::jsonb end,timeout_milliseconds:=55000);
 insert into walmart_daily_summary_dispatches(request_id) values(request);
 delete from walmart_daily_summary_dispatches where created_at<now()-interval '2 days';
 return request;
end $$;
create or replace function public.configure_walmart_daily_summary(p_origin text,p_secret text,p_bypass text default null) returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare pair record;existing uuid;job bigint;
begin
 if p_origin is null or p_origin !~ '^https://[a-zA-Z0-9.-]+$' or p_secret is null or length(p_secret)<16 then raise exception 'Invalid scheduler configuration';end if;
 perform pg_advisory_xact_lock(hashtextextended('soul:walmart-daily-config',0));
 for pair in select * from (values ('soul_daily_url',p_origin||'/api/notifications/daily/cron'),('soul_daily_secret',p_secret),('soul_daily_bypass',p_bypass)) as x(name,value) loop
  select id into existing from vault.secrets where name=pair.name;
  if existing is not null and pair.value is null then delete from vault.secrets where id=existing;
  elsif existing is null and pair.value is not null then perform vault.create_secret(pair.value,pair.name);
  elsif pair.value is not null then perform vault.update_secret(existing,pair.value);end if;
 end loop;
 select cron.schedule('soul-walmart-daily-summary','* * * * *','select public.invoke_walmart_daily_summary();') into job;
 return job;
end $$;
create or replace function public.walmart_daily_schedule_status() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare response record;queued timestamptz;
begin
 select max(created_at) into queued from walmart_daily_summary_dispatches;
 select r.status_code,r.created,r.timed_out into response from net._http_response r join walmart_daily_summary_dispatches d on d.request_id=r.id order by d.created_at desc limit 1;
 return jsonb_build_object('scheduled',exists(select 1 from cron.job where jobname='soul-walmart-daily-summary' and active),'queuedAt',queued,'responseAt',response.created,'httpStatus',response.status_code,'timedOut',response.timed_out);
end $$;
revoke all on function public.save_walmart_daily_webhook(uuid,boolean,boolean,text),public.claim_walmart_daily_summary(uuid,date,uuid),public.begin_walmart_daily_delivery(uuid,date,uuid,jsonb),public.invoke_walmart_daily_summary(),public.configure_walmart_daily_summary(text,text,text),public.walmart_daily_schedule_status() from public,anon,authenticated;
grant execute on function public.save_walmart_daily_webhook(uuid,boolean,boolean,text),public.claim_walmart_daily_summary(uuid,date,uuid),public.begin_walmart_daily_delivery(uuid,date,uuid,jsonb),public.invoke_walmart_daily_summary(),public.configure_walmart_daily_summary(text,text,text),public.walmart_daily_schedule_status() to service_role;
notify pgrst,'reload schema';
commit;
