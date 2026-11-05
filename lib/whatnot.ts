import {db} from './tiktok';

const BASE='https://api.whatnot.com/seller-api/rest/v2';
export function configured(){return Boolean(process.env.WHATNOT_API_TOKEN?.trim());}
function record(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
// Financial fields stay available while obvious customer/shipping PII is excluded.
function scrub(value:unknown):unknown{
 if(Array.isArray(value))return value.map(scrub);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>!/(buyer|recipient|customer|shipping_address|billing_address|email|phone|street|postal|zipcode|zip_code|first_name|last_name|full_name|tracking_number)/i.test(key)).map(([key,v])=>[key,scrub(v)]));
 return value;
}
export function textValue(v:unknown):string|null{return typeof v==='string'&&v.trim()?v.trim():typeof v==='number'&&Number.isFinite(v)?String(v):null;}
export function iso(v:unknown):string|null{
 if(typeof v==='number'&&Number.isFinite(v)){const d=new Date(v>1e12?v:v*1000);return Number.isNaN(d.valueOf())?null:d.toISOString();}
 if(typeof v!=='string'||!v.trim())return null;
 const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.toISOString();
}
export async function callWhatnot(path:string,query?:URLSearchParams){
 const token=process.env.WHATNOT_API_TOKEN?.trim();if(!token)throw Error('WHATNOT_API_TOKEN not configured in Vercel');
 const url=BASE+path+(query?.size?'?'+query.toString():'');
 const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  if(response.status===401||response.status===403)throw Error('Whatnot token expired or lacks read permissions ('+response.status+').');
  if(response.status===429)throw Error('Whatnot API rate limit. Retry after a short interval.');
  throw Error('Whatnot API request failed ('+response.status+').');
 }
 return await response.json() as unknown;
}
export function unwrap(v:unknown,key:string){const o=record(v);const data=record(o.data);const array=[o[key],data[key],o.results,data.results];return array.find(Array.isArray) as unknown[]|undefined;}
export function nextCursor(v:unknown){const o=record(v),d=record(o.data),page=record(o.pagination),dp=record(d.pagination);
 return textValue(o.next_page_token)||textValue(o.next_cursor)||textValue(d.next_page_token)||textValue(d.next_cursor)||textValue(page.next_page_token)||textValue(page.next_cursor)||textValue(dp.next_page_token)||textValue(dp.next_cursor);
}
export async function importWhatnot(ownerId:string){
 const client=db();let ordersCount=0,showsCount=0,orderPages=0,showPages=0;
 // The provider may return more than one page. Bound each invocation to avoid long Vercel executions.
 for(const kind of ['orders','shows'] as const){
  let cursor:string|null=null;const cursors=new Set<string>();
  for(let page=0;page<5;page++){
   const query=new URLSearchParams();if(cursor)query.set('page_token',cursor);
   const response=await callWhatnot('/'+kind,query);
   const items=unwrap(response,kind);
   if(!items)throw Error('Unexpected Whatnot /'+kind+' response. No data saved for this page; verify API format.');
   const rows=items.map(raw=>{
    const r=record(raw);const id=textValue(r.id)||textValue(r.order_id)||textValue(r.show_id);
    if(!id)return null;
    return {owner_id:ownerId,external_id:id,title:kind==='shows'?(textValue(r.title)||textValue(r.name)):null,status:textValue(r.status)||'unknown',created_at:iso(r.created_at)||iso(r.createdAt)||iso(r.start_time)||null,raw_record:scrub(r),synced_at:new Date().toISOString()};
   }).filter((v):v is NonNullable<typeof v>=>v!==null);
   if(items.length>0&&rows.length===0)throw Error('Whatnot '+kind+' records had no recognized IDs. Stopped rather than silently dropping them.');
   if(rows.length){const table=kind==='orders'?'whatnot_orders':'whatnot_shows';const {error}=await client.from(table).upsert(rows,{onConflict:'owner_id,external_id'});
    if(error)throw Error('Unable to save Whatnot '+kind+'. Run supabase/whatnot.sql first.');}
   if(kind==='orders'){ordersCount+=rows.length;orderPages++;}else{showsCount+=rows.length;showPages++;}
   const next=nextCursor(response);if(!next||cursors.has(next))break;cursors.add(next);cursor=next;
  }
 }
 return {ordersProcessed:ordersCount,showsProcessed:showsCount,orderPages,showPages,notice:'Imports are upserted by provider ID. This first phase does not calculate fees, revenue, or COGS from unverified fields.'};
}
