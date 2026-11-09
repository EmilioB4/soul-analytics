-- Run once to enable Walmart WFS stock/status tracking. No purchase lots,
-- sales or historical COGS are changed by this migration or by WFS sync.
create table if not exists public.walmart_wfs_inventory (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 data jsonb not null,
 last_seen_at timestamptz not null default now(),
 stale boolean not null default false,
 primary key(owner_id,sku),
 check(data->>'sku'=sku),
 check((data->>'available')::numeric>=0 and (data->>'reserved')::numeric>=0 and (data->>'inbound')::numeric>=0 and (data->>'on_hand')::numeric>=0)
);
create table if not exists public.walmart_wfs_syncs (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 last_sync_at timestamptz,
 last_attempt_at timestamptz,
 last_error text,
 lease_token uuid,
 lease_until timestamptz
);
create table if not exists public.walmart_wfs_changes (
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 sku text not null,
 changed_at timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb not null
);
create index if not exists walmart_wfs_changes_owner_idx on public.walmart_wfs_changes(owner_id,changed_at desc);
alter table public.walmart_wfs_inventory enable row level security;
alter table public.walmart_wfs_syncs enable row level security;
alter table public.walmart_wfs_changes enable row level security;
drop policy if exists walmart_wfs_inventory_read on public.walmart_wfs_inventory;
create policy walmart_wfs_inventory_read on public.walmart_wfs_inventory for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_wfs_syncs_read on public.walmart_wfs_syncs;
create policy walmart_wfs_syncs_read on public.walmart_wfs_syncs for select to authenticated using(auth.uid()=owner_id);
drop policy if exists walmart_wfs_changes_read on public.walmart_wfs_changes;
create policy walmart_wfs_changes_read on public.walmart_wfs_changes for select to authenticated using(auth.uid()=owner_id);
grant select on public.walmart_wfs_inventory,public.walmart_wfs_syncs,public.walmart_wfs_changes to authenticated;
grant all on public.walmart_wfs_inventory,public.walmart_wfs_syncs,public.walmart_wfs_changes to service_role;
grant usage,select on sequence public.walmart_wfs_changes_id_seq to service_role;
create or replace function public.claim_walmart_wfs_sync(p_owner uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare s public.walmart_wfs_syncs; token uuid;
begin
 insert into public.walmart_wfs_syncs(owner_id) values(p_owner) on conflict(owner_id) do nothing;
 select * into s from public.walmart_wfs_syncs where owner_id=p_owner for update;
 if not s.enabled or s.lease_until>now() or s.last_attempt_at>now()-interval '60 seconds' then return null;end if;
 token=gen_random_uuid();
 update public.walmart_wfs_syncs set lease_token=token,lease_until=now()+interval '90 seconds',last_attempt_at=now() where owner_id=p_owner;
 return token;
end $$;
create or replace function public.replace_walmart_wfs_inventory(p_owner uuid,p_items jsonb,p_lease uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare item jsonb; previous jsonb; key text;
begin
 perform 1 from public.walmart_wfs_syncs where owner_id=p_owner and lease_token=p_lease and lease_until>now() for update;
 if not found then raise exception 'WFS sync lease expired or changed; previous stock preserved';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50000 then raise exception 'Invalid WFS snapshot';end if;
 if (select count(distinct value->>'sku') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate or missing WFS SKU';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  key=item->>'sku';
  if key is null or key='' then raise exception 'Missing WFS SKU';end if;
  select data into previous from public.walmart_wfs_inventory where owner_id=p_owner and sku=key;
  if previous is distinct from item then
   insert into public.walmart_wfs_changes(owner_id,sku,before_data,after_data) values(p_owner,key,previous,item);
  end if;
  insert into public.walmart_wfs_inventory(owner_id,sku,data,last_seen_at,stale) values(p_owner,key,item,now(),false)
  on conflict(owner_id,sku) do update set data=excluded.data,last_seen_at=excluded.last_seen_at,stale=false;
 end loop;
 -- An absent catalog item is unknown/stale, not a zero-quantity sale.
 update public.walmart_wfs_inventory set stale=true where owner_id=p_owner and sku not in(select value->>'sku' from jsonb_array_elements(p_items));
 update public.walmart_wfs_syncs set last_sync_at=now(),last_error=null,lease_token=null,lease_until=null where owner_id=p_owner;
end $$;
revoke all on function public.claim_walmart_wfs_sync(uuid) from public,anon,authenticated;
revoke all on function public.replace_walmart_wfs_inventory(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.claim_walmart_wfs_sync(uuid),public.replace_walmart_wfs_inventory(uuid,jsonb,uuid) to service_role;
