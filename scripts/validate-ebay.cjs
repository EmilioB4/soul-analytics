const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table profiles(user_id uuid primary key references auth.users(id));grant usage on schema public to authenticated,service_role;");
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333';
 for(const id of [alice,bob]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles values($1)',[id]);}
 const sql=fs.readFileSync(require('path').join(__dirname,'../supabase/ebay_setup.sql'),'utf8');await db.exec(sql);await db.exec(sql);
 await db.query("insert into ebay_oauth_states values('hash',$1,now()+interval '1 minute')",[alice]);
 assert.equal((await db.query("select consume_ebay_oauth_state('hash') as id")).rows[0].id,alice);assert.equal((await db.query("select consume_ebay_oauth_state('hash') as id")).rows[0].id,null);
 await db.query("insert into ebay_oauth_states values('old',$1,now()-interval '1 minute')",[alice]);assert.equal((await db.query("select consume_ebay_oauth_state('old') as id")).rows[0].id,null);
 const save=id=>db.query("select save_ebay_connection($1,'seller','seller-name','encrypted-access','encrypted-refresh',now()+interval '1 hour',now()+interval '1 year')",[id]);await save(alice);await save(bob);
 await assert.rejects(db.query("select save_ebay_connection($1,'other-seller','name','access','refresh',now(),now())",[alice]));
 const version=(await db.query('select version from ebay_connections where owner_id=$1',[alice])).rows[0].version;
 assert.equal((await db.query('select claim_ebay_refresh($1,$2,$3) as ok',[bob,version,token])).rows[0].ok,false);
 assert.equal((await db.query('select claim_ebay_refresh($1,$2,$3) as ok',[alice,version,token])).rows[0].ok,true);
 assert.equal((await db.query('select claim_ebay_refresh($1,$2,$3) as ok',[alice,version,token])).rows[0].ok,false);
 assert.equal((await db.query("select claim_ebay_sync($1,'wrong-seller',$2) as ok",[alice,token])).rows[0].ok,false);
 assert.equal((await db.query("select claim_ebay_sync($1,'seller',$2) as ok",[alice,token])).rows[0].ok,true);
 const rows=JSON.stringify([{id:'order-1',createdAt:'2026-11-18T12:00:00Z'}]);
 await assert.rejects(db.query("select save_ebay_orders($1,'seller',$2,$3::jsonb)",[bob,token,rows]));
 await db.query("select save_ebay_orders($1,'seller',$2,$3::jsonb)",[alice,token,rows]);assert.equal((await db.query('select count(*)::int as n from ebay_orders where owner_id=$1',[bob])).rows[0].n,0);
 await db.exec('set role authenticated');
 for(const table of ['ebay_connections','ebay_oauth_states','ebay_orders','ebay_product_costs'])await assert.rejects(db.query('select * from '+table));
 await assert.rejects(db.query("select consume_ebay_oauth_state('hash')"));await assert.rejects(db.query('select disconnect_ebay($1)',[bob]));await db.exec('reset role');
 await db.query('select disconnect_ebay($1)',[alice]);assert.equal((await db.query('select count(*)::int as n from ebay_connections where owner_id=$1',[bob])).rows[0].n,1);
 await assert.rejects(db.query("select save_ebay_orders($1,'seller',$2,$3::jsonb)",[alice,token,rows]));
 await db.close();console.log('eBay SQL isolation, OAuth replay, refresh and sync leases passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
