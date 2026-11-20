const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table profiles(user_id uuid primary key references auth.users(id));grant usage on schema public to authenticated,service_role;');
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',carol='33333333-3333-4333-8333-333333333333';
 for(const id of [alice,bob,carol]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles values($1)',[id]);}
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/ebay_setup.sql'),'utf8'));
 const migration=fs.readFileSync(path.join(__dirname,'../supabase/ebay_account_deletion.sql'),'utf8');await db.exec(migration);await db.exec(migration);
 await db.exec('create table walmart_orders(id text);insert into walmart_orders values(\'preserved\');');
 const save=(owner,account)=>db.query("select save_ebay_connection($1,$2,'seller-name','encrypted-access','encrypted-refresh',now()+interval '1 hour',now()+interval '1 year')",[owner,account]);
 await save(alice,'deleted-seller');await save(bob,'other-seller');await save(carol,'deleted-seller');
 for(const [owner,account] of [[alice,'deleted-seller'],[bob,'other-seller'],[carol,'deleted-seller'],[bob,'deleted-seller']]){
  await db.query("insert into ebay_orders(owner_id,account_id,order_id,created_at,data) values($1,$2,'order',now(),'{}')",[owner,account]);
  await db.query("insert into ebay_product_costs values($1,$2,'sku',5)",[owner,account]);
 }
 for(const owner of [alice,bob,carol])await db.query('insert into ebay_oauth_states values($1,$2,now()+interval \'1 hour\')',[owner,owner]);
 await db.exec('set role authenticated');await assert.rejects(db.query("select delete_ebay_account_data('deleted-seller')"));await assert.rejects(db.query('select * from ebay_deleted_accounts'));await db.exec('reset role');
 // A failure part-way through cleanup must roll back the tombstone and earlier deletes.
 await db.exec("create function fail_test_delete() returns trigger language plpgsql as $$ begin raise exception 'temporary failure';end $$;create trigger fail_test before delete on ebay_orders for each row execute function fail_test_delete();");
 await assert.rejects(db.query("select delete_ebay_account_data('deleted-seller')"));
 assert.equal((await db.query('select count(*)::int n from ebay_connections')).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from ebay_deleted_accounts')).rows[0].n,0);
 await db.exec('drop trigger fail_test on ebay_orders;drop function fail_test_delete();set role service_role');
 await db.query("select delete_ebay_account_data('deleted-seller')");await db.query("select delete_ebay_account_data('deleted-seller')");await db.exec('reset role');
 for(const table of ['ebay_connections','ebay_orders','ebay_product_costs']){
  assert.equal((await db.query('select count(*)::int n from '+table+" where account_id='deleted-seller'")).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from '+table+" where account_id='other-seller'")).rows[0].n,1);
 }
 assert.equal((await db.query('select owner_id from ebay_oauth_states')).rows[0].owner_id,bob);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from profiles')).rows[0].n,3);
 assert.equal((await db.query('select * from walmart_orders')).rows[0].id,'preserved');
 await assert.rejects(save(alice,'deleted-seller'));
 await assert.rejects(db.query("insert into ebay_orders(owner_id,account_id,order_id,created_at,data) values($1,'deleted-seller','stale',now(),'{}')",[alice]));
 await assert.rejects(db.query("insert into ebay_product_costs values($1,'deleted-seller','stale',5)",[alice]));
 await db.query("select delete_ebay_account_data('unlinked-seller')");await assert.rejects(save(alice,'unlinked-seller'));
 const hash=(await db.query('select account_hash from ebay_deleted_accounts limit 1')).rows[0].account_hash;assert.match(hash,/^[a-f0-9]{64}$/);
 await db.close();console.log('eBay deletion migration passed: idempotence, role denial, all linked owners and disconnected history purged, other sellers/platforms preserved, stale writes blocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
