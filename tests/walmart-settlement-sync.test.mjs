import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as finance from '../lib/walmart-finance.ts';
const row=(key,amount)=>({'Transaction Key':key,'Transaction Type':'Sale','Amount Type':'WFS Prep Fee',Amount:amount,'Transaction Posted Timestamp':'11/08/2026'});
function setup(pages,{authorized=true,saveError=null}={}){
 const saved=[],calls=[];let page=0;
 const mocks={
 'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
 '../../../../../lib/tiktok':{owner:async()=>authorized?{id:'owner-1'}:null,db:()=>({rpc:async(name,args)=>{saved.push({name,args});return {error:saveError};}})},
 '../../../../../lib/walmart-api':{walmartAccessToken:async()=>'token',walmartReport:async(path)=>{calls.push(path);if(path.includes('availableReconFiles'))return {availableApReportDates:['11/09/2026']};const result=pages[page++];if(result instanceof Error)throw result;return result;}},
 '../../../../../lib/walmart-finance':finance
 };
 const exports={};const source=fs.readFileSync(new URL('../app/api/walmart/fees/sync/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
 vm.runInNewContext(code,{exports,require:(id)=>{if(!(id in mocks))throw Error(id);return mocks[id];},URL,Date,Set,Number,Error});
 const request={headers:new Headers({authorization:'Bearer user'}),json:async()=>({reportDate:'11/09/2026'})};
 return {run:()=>exports.POST(request),saved,calls};
}
test('downloads all pages using byte offsets before atomically replacing one report',async()=>{
 const s=setup([{reportData:[row('a','-2')],nextOffset:973},{reportData:[row('b','-3')],nextOffset:-1}]);
 const result=await s.run();assert.equal(result.status,200);assert.equal(result.body.fees,2);assert.equal(s.saved.length,1);
 assert.equal(s.saved[0].args.p_rows.length,2);assert.equal(s.saved[0].args.p_rows[1].row_index,1);assert.ok(s.calls[2].includes('offset=973'));
 assert.equal(s.saved[0].name,'replace_walmart_settlement_report');assert.equal(s.saved[0].args.p_owner,'owner-1');
});
test('second-page failures never save partial report data',async()=>{
 const s=setup([{reportData:[row('a','-2')],nextOffset:973},new Error('Walmart rate limit')]);
 const result=await s.run();assert.equal(result.status,502);assert.equal(s.saved.length,0);
});
test('unrecognized report shape and malformed amounts never replace saved reports',async()=>{
 for(const pages of [[{unexpected:[]}],[{reportData:[row('a','invalid')],nextOffset:0}]]){
  const s=setup(pages);assert.equal((await s.run()).status,502);assert.equal(s.saved.length,0);
 }
});
test('repeated offsets and empty continuation pages abort safely',async()=>{
 for(const pages of [[{reportData:[row('a','-2')],nextOffset:973},{reportData:[row('b','-3')],nextOffset:973}],[{reportData:[],nextOffset:973}]]){
  const s=setup(pages);assert.equal((await s.run()).status,502);assert.equal(s.saved.length,0);
 }
});
test('authentication is required before requesting or writing report data',async()=>{
 const s=setup([],{authorized:false});assert.equal((await s.run()).status,401);assert.equal(s.calls.length,0);assert.equal(s.saved.length,0);
});
test('database setup failures are visible rather than reported as successful syncs',async()=>{
 const s=setup([{reportData:[row('a','-2')],nextOffset:0}],{saveError:{message:'missing RPC'}});
 const result=await s.run();assert.equal(result.status,502);assert.match(result.body.error,/walmart_settlements.sql/);
});
