// In-memory PostgreSQL with pg_cron/pg_net/Vault API stubs; no hosted data or delivery.
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');const fs=require('fs');const assert=require('assert/strict');(async()=>{const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('11111111-1111-4111-8111-111111111111');create schema vault;create schema cron;create schema net;
create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(text,text) returns uuid language sql as 'insert into vault.secrets(secret,name) values($1,$2) returning id';create function vault.update_secret(uuid,text) returns void language sql as 'update vault.secrets set secret=$2 where id=$1';
create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);create function cron.schedule(text,text,text) returns bigint language sql as 'insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command,active=true returning jobid';
create table net.test_requests(id bigint generated always as identity primary key,url text,headers jsonb);create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as 'insert into net.test_requests(url,headers) values($1,$2) returning id';
create table net._http_response(id bigint,status_code integer,content_type text,headers jsonb,content text,timed_out bool,error_msg text,created timestamptz default now());`);

await db.exec(`create table profiles(user_id uuid primary key references auth.users(id));insert into profiles select id from auth.users;grant usage on schema public to authenticated,service_role;insert into auth.users values('33333333-3333-4333-8333-333333333333');insert into profiles values('33333333-3333-4333-8333-333333333333');`);

const sql=fs.readFileSync(require('path').join(__dirname,'../supabase/walmart_daily_summary.sql'),'utf8').split('\n').filter(l=>!l.startsWith('create extension')).join('\n');await db.exec(sql);await db.exec(sql);
const alice='11111111-1111-4111-8111-111111111111',bob='33333333-3333-4333-8333-333333333333',token='22222222-2222-4222-8222-222222222222';
const due=(await db.query("select case when (now() at time zone 'America/New_York')::time>=time '23:59' then (now() at time zone 'America/New_York')::date else (now() at time zone 'America/New_York')::date-1 end as day")).rows[0].day;
await db.query('select save_walmart_daily_webhook($1,true,true,null)',[alice]);
await db.query("update walmart_daily_webhooks set start_day=$2::date where owner_id=$1",[alice,due]);
assert.equal((await db.query('select claim_walmart_daily_summary($1,$2,$3) as ok',[alice,due,token])).rows[0].ok,true);
assert.equal((await db.query('select claim_walmart_daily_summary($1,$2,$3) as ok',[alice,due,token])).rows[0].ok,false);
assert.equal((await db.query('select begin_walmart_daily_delivery($1,$2,$3,$4) as ok',[bob,due,token,'{}'])).rows[0].ok,false);
assert.equal((await db.query('select begin_walmart_daily_delivery($1,$2,$3,$4) as ok',[alice,due,bob,'{}'])).rows[0].ok,false);
assert.equal((await db.query('select begin_walmart_daily_delivery($1,$2,$3,$4) as ok',[alice,due,token,'{"revenue":100}'])).rows[0].ok,true);
await db.query("update walmart_daily_summary_events set locked_until=now()-interval '1 minute' where owner_id=$1",[alice]);
assert.equal((await db.query('select claim_walmart_daily_summary($1,$2,$3) as ok',[alice,due,token])).rows[0].ok,false);
assert.equal((await db.query('select state from walmart_daily_summary_events where owner_id=$1',[alice])).rows[0].state,'uncertain');
await db.query("update walmart_daily_summary_events set state='building',locked_until=now()-interval '1 minute' where owner_id=$1",[alice]);
assert.equal((await db.query('select claim_walmart_daily_summary($1,$2,$3) as ok',[alice,due,token])).rows[0].ok,true);
await db.query("update walmart_daily_summary_events set state='sent' where owner_id=$1",[alice]);
assert.equal((await db.query('select claim_walmart_daily_summary($1,$2,$3) as ok',[alice,due,token])).rows[0].ok,false);
await db.query('select save_walmart_daily_webhook($1,true,true,null)',[bob]);
assert.equal((await db.query('select claim_walmart_daily_summary($1,($2::date-1),$3) as ok',[bob,due,token])).rows[0].ok,false);
await db.query('select save_walmart_daily_webhook($1,false,true,null)',[alice]);
assert.equal((await db.query('select begin_walmart_daily_delivery($1,$2,$3,$4) as ok',[alice,due,token,'{}'])).rows[0].ok,false);
await db.query("select configure_walmart_daily_summary('https://example.test','a-long-test-secret',null)");await db.query("select configure_walmart_daily_summary('https://example.test','a-long-test-secret',null)");
assert.equal((await db.query('select count(*)::int as n from cron.job')).rows[0].n,1);
await db.query('select invoke_walmart_daily_summary()');
assert.equal((await db.query('select url from net.test_requests')).rows[0].url,'https://example.test/api/notifications/daily/cron');
await db.exec('set role authenticated');await assert.rejects(db.query('select * from walmart_daily_webhooks'));await assert.rejects(db.query('select * from walmart_daily_summary_events'));await assert.rejects(db.query("select configure_walmart_daily_summary('https://evil.test','a-long-test-secret',null)"));await db.exec('reset role');
await db.close();console.log('Daily summary SQL lease, isolation and scheduler checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
