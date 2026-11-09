import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function route(path,{authorized=false,secret,header,records=null}={}){
 let databaseAccess=0,sends=0;const settings={enabled:true,tiktok_enabled:true,walmart_enabled:false,last_checked_at:null,last_error:null};
 const client={from:table=>{databaseAccess++;const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>Promise.resolve({data:[],error:null}),maybeSingle:async()=>({data:table==='payout_alert_settings'?records??settings:null,error:null})};return q;}};
 const exports={},auth={owner:async()=>authorized?{id:'owner-id'}:null,db:()=>client,encrypt:()=> 'encrypted'};
 const mocks={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'../../../../lib/tiktok':auth,'../../../../../lib/tiktok':auth,'../../../../lib/payout-events':{discordWebhookUrl:()=>''},'../../../../../lib/tiktok-orders':{decrypt:()=> 'secret'},'../../../../../lib/payout-alerts':{checkPayoutAlerts:async()=>{sends++;return {};},sendDiscord:async()=>{sends++;return {state:'sent'};}}};
 const source=fs.readFileSync(new URL('../app/api/notifications/payouts/'+path,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>{if(!mocks[id])throw Error(id);return mocks[id];},process:{env:{CRON_SECRET:secret}}});
 return {exports,request:{headers:new Headers(header?{authorization:header}:{})},access:()=>databaseAccess,sends:()=>sends};
}
test('every owner endpoint rejects unsigned requests before database or Discord access',async()=>{
 for(const [path,method] of [['route.ts','GET'],['route.ts','POST'],['check/route.ts','POST'],['test/route.ts','POST']]){const r=route(path);assert.equal((await r.exports[method](r.request)).status,401);assert.equal(r.access(),0);assert.equal(r.sends(),0);}
});
test('cron requires a configured and matching secret',async()=>{for(const options of [{},{secret:'configured'},{secret:'configured',header:'Bearer wrong'}]){const r=route('cron/route.ts',options);assert.equal((await r.exports.GET(r.request)).status,401);assert.equal(r.access(),0);assert.equal(r.sends(),0);}});
test('settings response exposes status and history, not a stored webhook',async()=>{const r=route('route.ts',{authorized:true});const result=await r.exports.GET(r.request);assert.equal(result.status,200);assert.equal(result.body.userId,'owner-id');assert.equal(result.body.configured,true);assert.doesNotMatch(JSON.stringify(result.body),/webhook_encrypted|https:\/\/discord|secret/);});
