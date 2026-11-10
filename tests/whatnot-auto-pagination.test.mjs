import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function setup(repeat=false){let n=0;const exports={};const mocks={'./tiktok':{db:()=>({from:()=>({upsert:async()=>({error:null})})})}};
 const source=fs.readFileSync(new URL('../lib/whatnot.ts',import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
 vm.runInNewContext(code,{exports,require:k=>mocks[k],process:{env:{WHATNOT_API_TOKEN:'synthetic'}},URL,URLSearchParams,Date,Set,Error,AbortSignal,fetch:async url=>({ok:true,json:async()=>String(url).includes('/orders')?{data:[{id:String(++n),created_at:'2026-11-10'}],next_cursor:repeat?'same':String(n)}:{data:[],next_cursor:null}})});return ()=>exports.importWhatnot('owner');}
test('bounded Whatnot imports identify remaining pages instead of claiming completeness',async()=>{const r=await setup()();assert.equal(r.ordersProcessed,5);assert.equal(r.incomplete,true);});
test('repeated Whatnot cursors fail visibly',async()=>{await assert.rejects(setup(true)(),/Repeated/);});
