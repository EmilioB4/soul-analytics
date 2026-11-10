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
