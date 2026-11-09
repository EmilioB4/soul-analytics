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
