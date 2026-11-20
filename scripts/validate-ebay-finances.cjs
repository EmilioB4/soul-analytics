const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table profiles(user_id uuid primary key references auth.users(id));grant usage on schema public to authenticated,service_role;');
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333',start='2026-11-01T00:00:00Z',end='2026-11-30T23:59:59Z';
 for(const id of [alice,bob]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles values($1)',[id]);}
 const sql=file=>fs.readFileSync(path.join(__dirname,'../supabase/'+file),'utf8');
 await db.exec(sql('ebay_setup.sql'));await db.exec(sql('ebay_account_deletion.sql'));await db.exec(sql('ebay_finances.sql'));await db.exec(sql('ebay_finances.sql'));
 for(const [id,account] of [[alice,'seller-a'],[bob,'seller-b']])await db.query("select save_ebay_connection($1,$2,'username','access','refresh',now()+interval '1 hour',now()+interval '1 year')",[id,account]);
 const claim=(id,account)=>db.query('select claim_ebay_sync($1,$2,$3)',[id,account,token]);
 const save=(id,account,rows)=>db.query('select save_ebay_finances($1,$2,$3,$4,$5,$6)',[id,account,token,start,end,JSON.stringify(rows)]);
 const row={id:'same-id',type:'SALE',date:'2026-11-18T12:00:00Z',signedCents:8500};
 await claim(alice,'seller-a');await assert.rejects(save(bob,'seller-a',[row]));await save(alice,'seller-a',[row,{...row,type:'SHIPPING_LABEL'}]);assert.equal((await db.query('select count(*)::int n from ebay_transactions')).rows[0].n,2);
 await assert.rejects(save(alice,'seller-a',[]));
 await claim(alice,'seller-a');await assert.rejects(save(alice,'seller-a',[row,row]));assert.equal((await db.query('select count(*)::int n from ebay_transactions')).rows[0].n,2);
 await assert.rejects(save(alice,'seller-a',[{...row,date:'2025-01-01T00:00:00Z'}]));assert.equal((await db.query('select count(*)::int n from ebay_transactions')).rows[0].n,2);
 await save(alice,'seller-a',[{...row,signedCents:8400}]);assert.equal((await db.query('select count(*)::int n from ebay_transactions')).rows[0].n,1);assert.equal((await db.query('select data from ebay_transactions')).rows[0].data.signedCents,8400);
 await claim(bob,'seller-b');await save(bob,'seller-b',[row]);
 await db.exec('set role authenticated');for(const table of ['ebay_transactions','ebay_finance_syncs'])await assert.rejects(db.query('select * from '+table));await assert.rejects(save(alice,'seller-a',[]));await db.exec('reset role');
 // Earlier deletion SQL can be rerun without silently losing finance cleanup.
 await db.exec(sql('ebay_account_deletion.sql'));await db.query("select delete_ebay_account_data('seller-a')");
 for(const table of ['ebay_transactions','ebay_finance_syncs']){assert.equal((await db.query('select count(*)::int n from '+table+" where account_id='seller-a'")).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from '+table+" where account_id='seller-b'")).rows[0].n,1);}
 await assert.rejects(db.query("insert into ebay_transactions values($1,'seller-a','SALE','late',now(),'{}')",[alice]));
 await db.close();console.log('eBay finances SQL passed: idempotence, owner/lease binding, atomic replacement and rollback, composite IDs, role denial and deletion/stale-write protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
