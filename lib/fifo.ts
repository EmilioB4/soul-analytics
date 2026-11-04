// Deterministic FIFO across *all* imported orders; don't reset lots at a reporting-window boundary.
export type SaleLine={shop_id:string;order_id:string;line_id:string;sku_id:string;quantity:number;currency:string;unit_sale_price:number|null};
export type SaleOrder={shop_id:string;order_id:string;status:string;created_at:string};
export type PurchaseBatch={id:string;shop_id:string;sku_id:string;acquired_on:string;quantity:number;unit_cost:number};
const key=(shop:string,sku:string)=>`${shop}::${sku}`;
export const lineKey=(l:Pick<SaleLine,'shop_id'|'order_id'|'line_id'>)=>`${l.shop_id}::${l.order_id}::${l.line_id}`;
const nyDate=(date:string)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/New_York'}).format(new Date(date));
export type Allocation={cost:number|null;missingUnits:number;method:'FIFO'|'Fixed'|'Missing'};
export function allocateFifo(lines:SaleLine[],orders:SaleOrder[],lots:PurchaseBatch[],legacy:Map<string,number>){
 const byOrder=new Map(orders.map(o=>[`${o.shop_id}::${o.order_id}`,o]));
 const bySku=new Map<string,(PurchaseBatch&{left:number})[]>();
 for(const lot of lots){const k=key(lot.shop_id,lot.sku_id);const xs=bySku.get(k)||[];xs.push({...lot,left:Number(lot.quantity)});bySku.set(k,xs)}
 for(const xs of bySku.values())xs.sort((a,b)=>a.acquired_on.localeCompare(b.acquired_on)||a.id.localeCompare(b.id));
 const sorted=[...lines].sort((a,b)=>{const x=byOrder.get(`${a.shop_id}::${a.order_id}`)?.created_at||'';const y=byOrder.get(`${b.shop_id}::${b.order_id}`)?.created_at||'';return x.localeCompare(y)||a.order_id.localeCompare(b.order_id)||a.line_id.localeCompare(b.line_id)});
 const allocations=new Map<string,Allocation>();
 for(const l of sorted){const o=byOrder.get(`${l.shop_id}::${l.order_id}`);if(!o||['UNPAID','CANCELLED','CANCELED'].includes(String(o.status).toUpperCase()))continue;const qty=Number(l.quantity);if(!Number.isSafeInteger(qty)||qty<=0)continue;const k=key(l.shop_id,l.sku_id);const xs=bySku.get(k);
 if(!xs?.length){const cost=legacy.get(k);allocations.set(lineKey(l),cost===undefined?{cost:null,missingUnits:qty,method:'Missing'}:{cost:Math.round(cost*qty*100)/100,missingUnits:0,method:'Fixed'});continue}
 let needed=qty,cost=0;const saleDay=nyDate(o.created_at);for(const lot of xs){if(lot.acquired_on>saleDay)break;const n=Math.min(needed,lot.left);if(n>0){cost+=n*Number(lot.unit_cost);lot.left-=n;needed-=n}if(needed===0)break}
 allocations.set(lineKey(l),{cost:needed===0?Math.round(cost*100)/100:null,missingUnits:needed,method:'FIFO'});
 }
 const remaining=new Map<string,number>();for(const [k,xs] of bySku)remaining.set(k,xs.reduce((n,x)=>n+x.left,0));
 return {allocations,remaining};
}
