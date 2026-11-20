import type {AccountingOrder,EbayTransaction} from './ebay-finances';
export type EbaySeriesPoint={date:string;sales:number;profit:number|null};
export function buildEbaySeries(transactions:EbayTransaction[],orders:AccountingOrder[],costs:{sku:string;unit_cost:number}[],start:string,end:string,profitReady:boolean):EbaySeriesPoint[]{
 const byOrder=new Map(orders.map(o=>[o.order_id,o])),bySku=new Map(costs.map(c=>[c.sku,Math.round(Number(c.unit_cost)*100)]));
 const seen=new Set<string>();
 const buckets=new Map<string,{sales:number;net:number;costs:number}>(),formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const t of transactions){const day=formatter.format(new Date(t.date));if(day<start||day>end||t.type==='TRANSFER')continue;const bucket=buckets.get(day)||{sales:0,net:0,costs:0};bucket.net+=t.signedCents;
  if(t.type==='SALE'&&t.orderId&&!seen.has(t.orderId)){seen.add(t.orderId);const o=byOrder.get(t.orderId);if(o){bucket.sales+=Math.round(o.data.revenue*100);for(const line of o.data.lines)bucket.costs+=(bySku.get(line.sku)||0)*line.quantity;bucket.costs+=Math.round(Number(o.packaging_cost||0)*100);if(o.shipping_mode!=='ebay')bucket.costs+=Math.round(Number(o.shipping_cost||0)*100);}}
  buckets.set(day,bucket);
 }
 const result:EbaySeriesPoint[]=[],cursor=new Date(start+'T12:00:00Z');
 for(let i=0;i<366;i++){const day=cursor.toISOString().slice(0,10);if(day>end)break;const bucket=buckets.get(day)||{sales:0,net:0,costs:0};result.push({date:day,sales:bucket.sales/100,profit:profitReady?(bucket.net-bucket.costs)/100:null});cursor.setUTCDate(cursor.getUTCDate()+1);}
 return result;
}
