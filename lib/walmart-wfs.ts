export type WfsItem={sku:string;name:string;gtin:string;item_id:string;publishing_status:string;lifecycle_status:string;stock_status:string;condition:string;available:number;reserved:number;inbound:number;on_hand:number;review:number;moving:number;listed_price?:number|null;price_currency?:string|null;price_seen_at?:string|null;price_error?:string|null;days_supply?:number|null;suggested_units?:number|null;aging_units?:number|null};
export type WfsRecord={sku:string;data:WfsItem;last_seen_at:string;stale:boolean};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function parseWfsItem(value:unknown):WfsItem{
 const row=object(value),info=object(row.itemInformation),stock=object(row.inventoryData),insights=object(row.inventoryInsights),age=object(stock.inventoryAge),unavailable=object(stock.unavailableUnits);
 const text=(v:unknown)=>typeof v==='string'?v.trim():v==null?'':String(v);
 const optional=(value:unknown)=>{if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;};
 const sku=text(info.sku);if(!sku)throw Error('WFS inventory row has no seller SKU; previous inventory preserved.');
 const qty=(v:unknown,key:string,optional=false)=>{if(v===undefined||v===null||v===''){if(optional)return 0;throw Error(`WFS ${sku} is missing ${key}; previous inventory preserved.`);}if(typeof v!=='string'&&typeof v!=='number')throw Error(`WFS ${sku} has invalid ${key}.`);const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>1e9)throw Error(`WFS ${sku} has invalid ${key}; previous inventory preserved.`);return n;};
 return {days_supply:optional(insights.daysOfSupply),suggested_units:optional(insights.suggestedUnits),aging_units:[age['91To180days'],age['181To270days'],age['271To365days'],age['365PlusDays']].every(v=>v!=null)?[age['91To180days'],age['181To270days'],age['271To365days'],age['365PlusDays']].reduce((n:number,v)=>n+Number(v),0):null,sku,name:text(info.itemName)||sku,gtin:text(info.gtin),item_id:text(info.itemID),publishing_status:text(stock.publishingStatus)||'Unknown',lifecycle_status:text(stock.itemLifecycle)||'Unknown',stock_status:text(stock.stockStatus)||'Unknown',condition:text(info.itemCondition)||'Unknown',available:qty(stock.availableUnits,'available units'),reserved:qty(stock.reservedUnits,'reserved units'),inbound:qty(stock.inboundUnits,'inbound units'),on_hand:qty(stock.onhandUnits,'on-hand units'),review:qty(unavailable.inventoryReviewUnits,'review units',true),moving:qty(unavailable.inventoryMovementUnits,'movement units',true)};
}
export async function downloadWfsInventory(get:(path:string)=>Promise<unknown>,budgetMs=35000):Promise<WfsItem[]>{
 const rows:WfsItem[]=[];const seen=new Set<string>();let offset=0,total:number|undefined;const start=Date.now();
 while(true){
  if(Date.now()-start>budgetMs)throw Error('WFS inventory sync exceeded its time budget; previous inventory preserved.');
  const response=object(await get(`/v3/wfs/inventory?limit=300&offset=${offset}`));
  const headers=object(response.headers),inventory=object(response.payload).inventory;
  if(!Array.isArray(inventory))throw Error('Unrecognized WFS inventory response; previous inventory preserved.');
  const count=Number(headers.totalCount);
  if(headers.totalCount==null||!Number.isSafeInteger(count)||count<0)throw Error('WFS inventory response is missing a valid totalCount.');
  if(total!==undefined&&count!==total)throw Error('WFS inventory changed during pagination; retry sync. Previous inventory preserved.');total=count;
  if(total>50000)throw Error('WFS inventory exceeds 50,000 SKUs; previous inventory preserved.');
  for(const raw of inventory){const item=parseWfsItem(raw);if(seen.has(item.sku))throw Error('WFS returned duplicate SKUs during pagination; previous inventory preserved.');seen.add(item.sku);rows.push(item);}
  offset+=inventory.length;
  if(offset===total)return rows;
  if(offset>total||!inventory.length)throw Error('WFS pagination is incomplete; previous inventory preserved.');
 }
}
export function wfsSummary(rows:WfsRecord[]){
 const active=rows.filter(r=>!r.stale);const sum=(key:'available'|'reserved'|'inbound'|'on_hand'|'review'|'moving')=>active.reduce((n,r)=>n+r.data[key],0);
 return {items:active.length,available:sum('available'),reserved:sum('reserved'),inbound:sum('inbound'),on_hand:sum('on_hand'),review:sum('review'),moving:sum('moving'),stale:rows.length-active.length};
}
