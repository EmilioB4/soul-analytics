import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import * as events from '../lib/payout-events.ts';
const event={platform:'tiktok',id:'shop:p1',stage:'processing',amount:100,currency:'USD',date:'2026-11-09',description:'Processing'};
function setup({status=200,networkError=false}={}){
 const rows={payout_alert_settings:[{owner_id:'u1',enabled:true,tiktok_enabled:true,walmart_enabled:false,webhook_encrypted:'encrypted',lock_token:null}],payout_alert_sources:[],payout_alert_events:[]};let source=[event],fetches=0,busy=false;
 const client={rpc:async(_,{p_token})=>{if(busy)return {data:false,error:null};busy=true;rows.payout_alert_settings[0].lock_token=p_token;return {data:true,error:null};},from:table=>{
  let filters=[],operation='select',values,ignore=false,single=false;
  const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},match:obj=>{for(const [k,v]of Object.entries(obj))q.eq(k,v);return q;},in:(k,v)=>{filters.push(r=>v.includes(r[k]));return q;},limit:()=>q,maybeSingle:()=>{single=true;return q;},single:()=>{single=true;return q;},update:v=>{operation='update';values=v;return q;},insert:v=>{operation='insert';values=v;return q;},upsert:(v,o)=>{operation='upsert';values=v;ignore=o.ignoreDuplicates;return q;},then:(ok,bad)=>Promise.resolve().then(()=>{
   const matched=rows[table].filter(r=>filters.every(f=>f(r)));
   if(operation==='update'){for(const row of matched){Object.assign(row,values);if(table==='payout_alert_settings'&&values.lock_token===null)busy=false;}return {data:null,error:null};}
   if(operation==='insert'||operation==='upsert'){for(const value of Array.isArray(values)?values:[values]){const duplicate=table==='payout_alert_events'&&rows[table].some(r=>['owner_id','platform','event_id','stage'].every(k=>r[k]===value[k]));if(duplicate){if(ignore)continue;return {error:{message:'duplicate'}};}rows[table].push({...value});}return {data:null,error:null};}
   return {data:single?matched[0]||null:matched,error:null};
  }).then(ok,bad)};return q;}};
 const mocks={'./tiktok':{db:()=>client},'./tiktok-orders':{decrypt:()=> 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123'},'./payout-sources':{collectPayouts:async()=>{if(source instanceof Error)throw source;return source;}},'./payout-events':events};const exports={};
 const code=ts.transpileModule(fs.readFileSync(new URL('../lib/payout-alerts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>mocks[id],crypto:{randomUUID:()=> 'lease'},URL,Date,Map,Set,Error,AbortSignal,fetch:async()=>{fetches++;if(networkError)throw Error('network contains secret');return {status,ok:status===200,json:async()=>({id:'discord-msg',retry_after:30})};}});
 return {rows,run:()=>exports.checkPayoutAlerts('u1'),source:v=>{source=v;},fetches:()=>fetches};
}
test('first check baselines existing payouts; repeats stay quiet and a new paid status sends once',async()=>{
 const s=setup();await s.run();assert.equal(s.fetches(),0);assert.equal(s.rows.payout_alert_events[0].state,'baseline');
 await s.run();assert.equal(s.fetches(),0);s.source([{...event,stage:'paid'}]);await s.run();assert.equal(s.fetches(),1);assert.equal(s.rows.payout_alert_events[1].state,'sent');await s.run();assert.equal(s.fetches(),1);
});
test('manual and cron races are serialized by the lease',async()=>{const s=setup();const results=await Promise.all([s.run(),s.run()]);assert.equal(results.filter(r=>r.skipped).length,1);assert.equal(s.fetches(),0);});
test('429 deliveries wait until a later check and never mark a failed send delivered',async()=>{const s=setup({status:429});await s.run();s.source([{...event,id:'shop:new'}]);await s.run();assert.equal(s.fetches(),1);assert.equal(s.rows.payout_alert_events[1].state,'retry');await s.run();assert.equal(s.fetches(),1);});
test('ambiguous network failures do not automatically resend; interrupted sends become uncertain',async()=>{const s=setup({networkError:true});await s.run();s.source([{...event,id:'shop:new'}]);await s.run();assert.equal(s.rows.payout_alert_events[1].state,'uncertain');await s.run();assert.equal(s.fetches(),1);assert.doesNotMatch(s.rows.payout_alert_settings[0].last_error||'',/secret/);s.rows.payout_alert_events[1].state='sending';await s.run();assert.equal(s.rows.payout_alert_events[1].state,'uncertain');assert.equal(s.fetches(),1);});

test('failed source retrieval never initializes a partial baseline',async()=>{const s=setup();s.source(new Error('provider down'));const result=await s.run();assert.equal(result.baselined,0);assert.equal(s.rows.payout_alert_sources.length,0);assert.equal(s.fetches(),0);s.source([event]);await s.run();assert.equal(s.rows.payout_alert_events[0].state,'baseline');assert.equal(s.fetches(),0);});
