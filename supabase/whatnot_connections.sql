begin;
create table if not exists public.whatnot_connections(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 seller_id text not null,username text not null,token_encrypted text,updated_at timestamptz not null default now()
);
alter table public.whatnot_connections enable row level security;
revoke all on public.whatnot_connections from public,anon,authenticated;
grant all on public.whatnot_connections to service_role;
create or replace function public.save_whatnot_connection(p_owner uuid,p_seller text,p_username text,p_token text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where user_id=p_owner) then raise exception 'Account not admitted';end if;
 insert into whatnot_connections(owner_id,seller_id,username,token_encrypted) values(p_owner,p_seller,p_username,p_token)
 on conflict(owner_id) do update set username=excluded.username,token_encrypted=excluded.token_encrypted,updated_at=now()
 where whatnot_connections.seller_id=excluded.seller_id;
 if not found then raise exception 'Whatnot seller does not match your existing connection';end if;
end $$;
revoke all on function public.save_whatnot_connection(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.save_whatnot_connection(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
