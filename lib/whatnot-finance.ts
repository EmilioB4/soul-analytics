import {db} from './tiktok';
import {callWhatnot,unwrap,textValue} from './whatnot';

type Dict=Record<string,unknown>;
const asObj=(v:unknown):Dict=>v&&typeof v==='object'&&!Array.isArray(v)?v as Dict:{};
const txt=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const num=(v:unknown):number|null=>{const s=txt(v);if(!s)return null;const n=Number(s.replace(/[$,]/g,''));return Number.isFinite(n)?n:null;};
const iso=(v:unknown):string|null=>{const s=txt(v);if(!s)return null;const d=new Date(s);return Number.isNaN(+d)?null:d.toISOString();};
function parseCSV(input:string):Dict[]{
 const lines:string[][]=[];let row:string[]=[],field='',quote=false;
 const source=input.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quote){if(c==='"'&&source[i+1]==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}
  else if(c==='"')quote=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'){row.push(field.replace(/\r$/,''));lines.push(row);row=[];field='';}
  else field+=c;
 }
 if(quote)throw Error('Incomplete Whatnot financial report CSV.');
 if(field||row.length){row.push(field.replace(/\r$/,''));lines.push(row);}
 const header=lines.shift()?.map(h=>h.trim().toLowerCase())||[];
 if(!header.includes('ledger_transaction_id')||!header.includes('transaction_amount')||!header.includes('transaction_type'))throw Error('Whatnot financial CSV is missing required ledger columns.');
 return lines.filter(r=>r.some(s=>s.trim())).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}
const weeksBack=12;
function weekWindow(weeksAgo:number){
 const now=new Date();const monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7)-7*weeksAgo);
 const end=new Date(monday);end.setUTCDate(end.getUTCDate()+7);
 return {start:monday.toISOString(),end:end.toISOString()};
}
async function requestReport(start:string,end:string){
 const body={report_type:'seller_financial_report',report_parameters:{report_type:'seller_financial_report',start_date:start,end_date:end}};
 const result=asObj(await callWhatnot('/reports',undefined,{method:'POST',body}));
 const r=asObj(result.data);const o=Object.keys(r).length?r:result;
 const id=textValue(o.id)||textValue(o.report_id);
 if(!id)throw Error('Whatnot created an unrecognized financial report response (no report ID).');
 return {id,status:txt(o.status)||'pending'};
}
async function getReport(id:string){
 const result=asObj(await callWhatnot('/reports/'+encodeURIComponent(id)));
 const r=asObj(result.data);return Object.keys(r).length?r:result;
}
async function importReport(ownerId:string,id:string,url:string){
 // Only download URLs provided directly by Whatnot, and never persist their presigned values.
 const parsed=new URL(url);
 if(parsed.protocol!=='https:' || !(/(^|\.)whatnot\.com$|(^|\.)whatnotcdn\.com$|(^|\.)amazonaws\.com$|(^|\.)cloudfront\.net$|(^|\.)googleapis\.com$/.test(parsed.hostname)))throw Error('Financial report download host not recognized; no data imported.');
 const res=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error('Report file download failed ('+res.status+').');
 const length=Number(res.headers.get('content-length')||0);if(length>8_000_000)throw Error('Report exceeds 8 MB safeguard.');
 const content=await res.text();if(content.length>8_000_000)throw Error('Report exceeds 8 MB safeguard.');
 const rows=parseCSV(content);
 if(rows.length>15000)throw Error('Financial report has too many rows for one sync.');
 const ids=new Set<string>();let accepted=0;
 for(let offset=0;offset<rows.length;offset+=200){
  const mapped=rows.slice(offset,offset+200).map(r=>{
   const tx=txt(r.ledger_transaction_id);if(!tx||ids.has(tx))return null;ids.add(tx);
   const amount=num(r.transaction_amount);if(amount===null)throw Error('Financial report includes a transaction without a valid amount.');
   const currency=txt(r.transaction_currency).toUpperCase()||'USD';
   if(currency!=='USD')throw Error('Non-USD financial entry detected. Multi-currency reporting is not configured.');
   return {owner_id:ownerId,ledger_transaction_id:tx,completed_at:iso(r.transaction_completed_at_utc),order_id:txt(r.order_id)||null,livestream_id:txt(r.livestream_id)||null,livestream_title:txt(r.livestream_title)||null,transaction_type:txt(r.transaction_type).toUpperCase(),currency,amount,sale_price:num(r.post_coupon_price),commission_fee:num(r.commission_fee),processing_fee:num(r.processing_fee??r.payment_processing_fee),commission_tax:num(r.commission_tax??r.tax_on_commission_fee),processing_tax:num(r.processing_fee_tax??r.tax_on_payment_processing_fee),seller_shipping:num(r.seller_shipping_charge??r.shipping_fee),import_report_id:id,updated_at:new Date().toISOString()};
  }).filter((r):r is NonNullable<typeof r>=>r!==null);
  if(mapped.length){const {error}=await db().from('whatnot_ledger').upsert(mapped,{onConflict:'owner_id,ledger_transaction_id'});if(error)throw Error('Unable to save financial ledger. Ensure whatnot_financials.sql was installed.');accepted+=mapped.length;}
 }
 return accepted;
}
export async function syncFinancialReports(ownerId:string){
 const client=db();let imported=0,completed=0,created=0;
 // Poll up to six completed/pending runs each invocation (the report API is asynchronous).
 const {data:pending,error:pErr}=await client.from('whatnot_report_runs').select('*').eq('owner_id',ownerId).is('imported_at',null).order('created_at',{ascending:true}).limit(2);
 if(pErr)throw Error('Financial tables missing. Run supabase/whatnot_financials.sql first.');
 for(const run of pending||[]){
  const report=await getReport(String(run.report_id));const status=txt(report.status)||'unknown';
  if(status==='completed'){
   const url=txt(report.report_url);if(!url)throw Error('Completed Whatnot report does not include a download URL.');
   imported+=await importReport(ownerId,String(run.report_id),url);completed++;
   const {error}=await client.from('whatnot_report_runs').update({status,updated_at:new Date().toISOString(),imported_at:new Date().toISOString()}).eq('owner_id',ownerId).eq('report_id',run.report_id);if(error)throw Error('Unable to mark financial report imported.');
  }else if(status==='failed'||status==='cancelled'){
   await client.from('whatnot_report_runs').update({status,updated_at:new Date().toISOString()}).eq('owner_id',ownerId).eq('report_id',run.report_id);
  }else await client.from('whatnot_report_runs').update({status,updated_at:new Date().toISOString()}).eq('owner_id',ownerId).eq('report_id',run.report_id);
 }
 // Backfill one missing weekly window per invocation, then daily cron continues automatically.
 // Include current week so today’s newly completed financial transactions are picked up.
 // Prioritize unrequested historical weeks; refreshing recent reports must not starve backfill.
 for(let weeksAgo=0;weeksAgo<=weeksBack;weeksAgo++){
  if(created>=2)break;
  const win=weekWindow(weeksAgo);
  const {data,error}=await client.from('whatnot_report_runs').select('report_id').eq('owner_id',ownerId).eq('start_at',win.start).eq('end_at',win.end).maybeSingle();
  if(error)throw Error('Unable to inspect Whatnot financial report history.');
  if(data)continue;
  const run=await requestReport(win.start,win.end);
  const {error:insErr}=await client.from('whatnot_report_runs').insert({owner_id:ownerId,report_id:run.id,start_at:win.start,end_at:win.end,status:run.status});
  if(insErr)throw Error('Could not save the newly generated report run.');
  created++;
 }
 // After backfill is completed, refresh only one recent completed week per run.
 if(created===0){
  for(let weeksAgo=0;weeksAgo<=2;weeksAgo++){
   const win=weekWindow(weeksAgo);
   const {data}=await client.from('whatnot_report_runs').select('report_id,status,created_at,imported_at').eq('owner_id',ownerId).eq('start_at',win.start).eq('end_at',win.end).maybeSingle();
   if(!data||!data.imported_at||Date.now()-Date.parse(data.created_at)<24*3600*1000)continue;
   const {error:delErr}=await client.from('whatnot_report_runs').delete().eq('owner_id',ownerId).eq('report_id',data.report_id);
   if(delErr)throw Error('Unable to refresh stale report run.');
   const run=await requestReport(win.start,win.end);
   const {error:insErr}=await client.from('whatnot_report_runs').insert({owner_id:ownerId,report_id:run.id,start_at:win.start,end_at:win.end,status:run.status});
   if(insErr)throw Error('Could not save refreshed financial report run.');
   created++;break;
  }
 }
 return {reportsGenerated:created,reportsCompleted:completed,ledgerRowsProcessed:imported,notice:'Reports are asynchronous. Run sync again after Whatnot finishes generating a report; daily cron will continue backfilling.'};
}
