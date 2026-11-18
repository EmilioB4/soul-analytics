-- READ ONLY inventory for the project administrator. Run separately on both projects.
-- Contains user IDs/emails and estimated row counts, never connection secrets or bank records.
-- Keep results private. This does not change application tables or users.
begin read only;
select id as user_id,email,email_confirmed_at from auth.users where id in (select user_id from public.profiles) order by email;
select c.table_name,string_agg(c.column_name,', ' order by c.ordinal_position) as columns
from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
where c.table_schema='public' and t.table_type='BASE TABLE'
group by c.table_name order by c.table_name;
select relname as table_name,n_live_tup as estimated_rows from pg_stat_user_tables where schemaname='public' order by relname;
-- Estimates help identify datasets; the transfer preview computes exact scoped counts.
rollback;
