import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function setup(path,{profiles=['actor'],binding=null,envOwner,enabled=true,url='https://soul.example.com'}={}){
 const calls=[];let stored=binding,writes=0;const exports={};const client={rpc:async(name,args)=>{calls.push({name,args});return {data:1,error:null};},from:table=>{const q={select:()=>q,eq:()=>q,limit:async()=>({data:profiles.map(user_id=>({user_id})),error:null}),maybeSingle:async()=>({data:table==='payout_alert_settings'?{enabled}:stored?{owner_id:stored}:null,error:null}),upsert:async row=>{writes++;stored||=row.owner_id;return {error:null};}};return q;}};
 const mocks={'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'../../../../../lib/tiktok':{owner:async()=>({id:'actor'}),db:()=>client},'../../../../../lib/payout-brand':{payoutSiteUrl:()=>url}};
 const source=fs.readFileSync(new URL('../app/api/notifications/payouts/'+path+'/route.ts',import.meta.url),'utf8');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{exports,require:id=>mocks[id],process:{env:{CRON_SECRET:'synthetic-cron-secret',WALMART_OWNER_ID:envOwner}},Error});return {run:()=>exports.POST({headers:new Headers()}),calls,stored:()=>stored,writes:()=>writes};
}
test('sole approved owner can link Walmart, but multiple owners and existing bindings block takeover',async()=>{
 const sole=setup('walmart-owner');assert.equal((await sole.run()).status,200);assert.equal(sole.stored(),'actor');
 const many=setup('walmart-owner',{profiles:['actor','other']});assert.equal((await many.run()).status,409);assert.equal(many.writes(),0);
 const existing=setup('walmart-owner',{binding:'other'});assert.equal((await existing.run()).status,409);assert.equal(existing.stored(),'other');
 const env=setup('walmart-owner',{envOwner:'other'});assert.equal((await env.run()).status,409);assert.equal(env.writes(),0);
});
test('scheduler uses trusted server origin and never returns the cron secret',async()=>{
 const s=setup('schedule');const result=await s.run();assert.equal(result.status,200);assert.equal(s.calls[0].args.p_url,'https://soul.example.com/api/notifications/payouts/cron');assert.equal(s.calls[0].args.p_secret,'synthetic-cron-secret');assert.doesNotMatch(JSON.stringify(result.body),/secret/);
 for(const opts of [{enabled:false},{url:null}]){const denied=setup('schedule',opts);assert.ok((await denied.run()).status>=400);assert.equal(denied.calls.length,0);}
});
