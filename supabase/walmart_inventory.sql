-- One-time inventory setup. This does not change sales, fees, settlements or COGS.
create table if not exists public.walmart_inventory_lots (
 owner_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null,
 data jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(owner_id,external_id),
 check(jsonb_typeof(data)='object'),
 check(data->>'id'=external_id),
 check(length(data->>'sku')>0 and length(data->>'name')>0),
 check((data->>'qty')::numeric>=0 and (data->>'qty')::numeric=trunc((data->>'qty')::numeric)),
 check((data->>'sold')::numeric>=0 and (data->>'sold')::numeric=trunc((data->>'sold')::numeric)),
 check((data->>'left')::numeric=(data->>'qty')::numeric-(data->>'sold')::numeric and (data->>'left')::numeric>=0)
);
create table if not exists public.walmart_inventory_history (
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 external_id text not null,
 reason text not null,
 changed_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb not null
);
create index if not exists walmart_inventory_history_owner_idx on public.walmart_inventory_history(owner_id,changed_at desc);
alter table public.walmart_inventory_lots enable row level security;
alter table public.walmart_inventory_history enable row level security;
drop policy if exists walmart_inventory_read on public.walmart_inventory_lots;
create policy walmart_inventory_read on public.walmart_inventory_lots for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_inventory_history_read on public.walmart_inventory_history;
create policy walmart_inventory_history_read on public.walmart_inventory_history for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_inventory_lots,public.walmart_inventory_history to authenticated;
grant all on public.walmart_inventory_lots,public.walmart_inventory_history to service_role;
grant usage,select on sequence public.walmart_inventory_history_id_seq to service_role;
create or replace function public.log_walmart_inventory_change() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 insert into public.walmart_inventory_history(owner_id,external_id,reason,before_data,after_data)
 values(new.owner_id,new.external_id,coalesce(nullif(current_setting('app.inventory_reason',true),''),'Inventory update'),case when TG_OP='UPDATE' then old.data else null end,new.data);
 return new;
end $$;
drop trigger if exists walmart_inventory_audit on public.walmart_inventory_lots;
create trigger walmart_inventory_audit after insert or update on public.walmart_inventory_lots for each row execute function public.log_walmart_inventory_change();
create or replace function public.save_walmart_inventory(p_owner uuid,p_rows jsonb,p_reason text,p_expected_version text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb; existing_version timestamptz;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>5000 then raise exception 'Invalid inventory import size';end if;
 if p_expected_version is not null and jsonb_array_length(p_rows)<>1 then raise exception 'Edit requires one lot';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':walmart-inventory',0));
 perform set_config('app.inventory_reason',left(p_reason,300),true);
 for item in select value from jsonb_array_elements(p_rows) loop
  if p_expected_version is not null then
   select updated_at into existing_version from public.walmart_inventory_lots where owner_id=p_owner and external_id=item->>'id';
   if existing_version is null or existing_version<>p_expected_version::timestamptz then raise exception 'Inventory changed in another session';end if;
  end if;
  insert into public.walmart_inventory_lots(owner_id,external_id,data) values(p_owner,item->>'id',item)
  on conflict(owner_id,external_id) do update set data=excluded.data,updated_at=clock_timestamp()
  where walmart_inventory_lots.data is distinct from excluded.data;
 end loop;
end $$;
revoke all on function public.save_walmart_inventory(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.save_walmart_inventory(uuid,jsonb,text,text) to service_role;
revoke all on function public.log_walmart_inventory_change() from public,anon,authenticated;
grant execute on function public.log_walmart_inventory_change() to service_role;
