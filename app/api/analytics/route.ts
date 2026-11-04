import {NextRequest,NextResponse} from 'next/server';
import {db,owner} from '../../../lib/tiktok';
export const runtime='nodejs';
type Period='day'|'week'|'month'|'ytd';
const timeZone='America/New_York';
const parts=(value:Date)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(value).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const dateKey=(d:Date)=>{const p=parts(d);return `${p.year}-${p.month}-${p.day}`;};
const addDays=(ymd:string,n:number)=>{const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const raw=req.nextUrl.searchParams.get('period');
  const period:Period=raw==='day'||raw==='week'||raw==='month'||raw==='ytd'?raw:'week';
  const now=new Date();const today=dateKey(now);
  const todayDate=new Date(`${today}T12:00:00Z`);
  const dayOfWeek=todayDate.getUTCDay();
  const start=period==='day'?today:period==='week'?addDays(today,-((dayOfWeek+6)%7)):period==='month'?`${today.slice(0,7)}-01`:`${today.slice(0,4)}-01-01`;
  // Fetch an extra UTC day on each side; use exact New York local dates to filter records.
  const utcLower=new Date(`${addDays(start,-1)}T00:00:00Z`).toISOString();
  const client=db();const all:any[]=[];let limited=false;
  for(let offset=0;offset<20000;offset+=1000){
   const {data,error}=await client.from('tiktok_orders').select('shop_id,order_id,status,currency,product_subtotal,created_at,synced_at').eq('owner_id',user.id).gte('created_at',utcLower).order('created_at',{ascending:true}).order('order_id',{ascending:true}).range(offset,offset+999);
   if(error)throw Error('Unable to read imported orders');
   if(!data?.length)break;
   all.push(...data);
   if(data.length<1000)break;
   if(offset===19000)limited=true;
  }
  const dateAllowed=(date:string|null)=>{if(!date)return false;const k=dateKey(new Date(date));return k>=start&&k<=today;};
  const orders=all.filter(o=>dateAllowed(o.created_at));
  const payable=orders.filter(o=>!['UNPAID','CANCELLED','CANCELED'].includes(o.status)&&o.currency==='USD'&&o.product_subtotal!==null);
  const saleIds=new Set(payable.map(o=>`${o.shop_id}:${o.order_id}`));
  const total=round(payable.reduce((a,o)=>a+Number(o.product_subtotal),0));
  const bucketMap=new Map<string,{label:string;value:number;orders:number}>();
  if(period==='day')for(let h=0;h<24;h++){const key=String(h).padStart(2,'0');bucketMap.set(key,{label:`${h===0?12:h>12?h-12:h}${h<12?'am':'pm'}`,value:0,orders:0});}
  else if(period==='ytd'){for(let m=1;m<=Number(today.slice(5,7));m++){const key=`${today.slice(0,4)}-${String(m).padStart(2,'0')}`;bucketMap.set(key,{label:new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),value:0,orders:0});}}
  else for(let k=start;k<=today;k=addDays(k,1)){bucketMap.set(k,{label:period==='week'?new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}):String(Number(k.slice(-2))),value:0,orders:0});}
  for(const o of payable){const p=parts(new Date(o.created_at));const date=`${p.year}-${p.month}-${p.day}`;const key=period==='day'?p.hour:period==='ytd'?date.slice(0,7):date;const b=bucketMap.get(key);if(b){b.value+=Number(o.product_subtotal);b.orders++;}}
  let topSellers:{name:string;image:string|null;skuId:string;quantity:number;sales:number}[]=[];
  let estimatedProfit:number|null=null,estimatedFees=0,estimatedCOGS=0,pricedProductSales=0,unpricedSkuCount=0,pricedSkuCount=0,productLineCount=0;
  const fullyPricedOrderIds=new Set<string>();
  const ordersWithUnpricedLines=new Set<string>();
  if(saleIds.size){
   const lines:any[]=[];
   for(let offset=0;offset<10000;offset+=1000){
    const {data,error}=await client.from('tiktok_order_items').select('shop_id,order_id,sku_id,product_name,sku_image,quantity,unit_sale_price,currency').eq('owner_id',user.id).range(offset,offset+999);
    if(error)break;
    if(!data?.length)break;
    lines.push(...data);
    if(data.length<1000)break;
    if(offset===9000)limited=true;
   }
   const {data:costRows,error:costError}=await client.from('tiktok_product_costs').select('shop_id,sku_id,unit_cogs').eq('owner_id',user.id).limit(5000);
   if(costError)throw Error('Unable to read saved product costs');
   if((costRows||[]).length===5000)limited=true;
   const costs=new Map((costRows||[]).map(c=>[`${c.shop_id}:${c.sku_id}`,Number(c.unit_cogs)]));
   const skuStatus=new Map<string,boolean>();
   const top=new Map<string,{name:string;image:string|null;skuId:string;quantity:number;sales:number}>();
   for(const line of lines){if(!saleIds.has(`${line.shop_id}:${line.order_id}`))continue;productLineCount++;const key=`${line.shop_id}:${line.sku_id}`;const item=top.get(key)||{name:line.product_name||'Unnamed product',image:line.sku_image||null,skuId:line.sku_id,quantity:0,sales:0};const qty=Number(line.quantity)||0;item.quantity+=qty;if(line.currency==='USD'&&line.unit_sale_price!=null)item.sales+=qty*Number(line.unit_sale_price);top.set(key,item);
    const cost=costs.get(key);
    const orderKey=`${line.shop_id}:${line.order_id}`;
    const priced=line.currency==='USD'&&line.unit_sale_price!=null&&Number.isFinite(Number(line.unit_sale_price))&&cost!==undefined&&Number.isFinite(cost);
    skuStatus.set(key,(skuStatus.get(key)??true)&&priced);
    if(priced)fullyPricedOrderIds.add(orderKey);else ordersWithUnpricedLines.add(orderKey);
    if(priced){const sales=qty*Number(line.unit_sale_price);pricedProductSales+=sales;estimatedFees+=sales*0.06;estimatedCOGS+=qty*cost;}
   }
   pricedSkuCount=[...skuStatus.values()].filter(Boolean).length;unpricedSkuCount=[...skuStatus.values()].filter(v=>!v).length;
   estimatedProfit=pricedProductSales>0?round(pricedProductSales-estimatedFees-estimatedCOGS):null;
   topSellers=[...top.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,6).map(x=>({...x,sales:round(x.sales)}));
  }
  // TikTok v202501 settlement shipping is a signed contribution (charges are negative).
  // Invert it to display seller expense as positive; credits/rebates can produce a negative expense.
  // Shipping is sourced only from imported settlement records, not buyer checkout shipping.
  const finance:any[]=[];
  for(let offset=0;offset<10000;offset+=1000){
   const {data,error}=await client.from('tiktok_order_finance').select('shop_id,order_id,currency,shipping_cost_amount').eq('owner_id',user.id).range(offset,offset+999);
   if(error)throw Error('Unable to read imported finance records');
   if(!data?.length)break;
   finance.push(...data);
   if(data.length<1000)break;
   if(offset===9000)limited=true;
  }
  const periodIds=new Set(payable.map(o=>`${o.shop_id}:${o.order_id}`));
  const shippingByOrder=new Map<string,number>();
  for(const f of finance){
   const key=`${f.shop_id}:${f.order_id}`;
   if(periodIds.has(key)&&f.currency==='USD'&&f.shipping_cost_amount!=null&&Number.isFinite(Number(f.shipping_cost_amount)))shippingByOrder.set(key,-Number(f.shipping_cost_amount));
  }
  // Charge shipping only on orders whose complete product lines have a known cost.
  // A missing settlement shipping field is UNKNOWN, not zero.
  const pricedOrderIds=new Set([...fullyPricedOrderIds].filter(k=>!ordersWithUnpricedLines.has(k)));
  const coveredPricedOrderIds=[...pricedOrderIds].filter(k=>shippingByOrder.has(k));
  const estimatedSellerShipping=round(coveredPricedOrderIds.reduce((sum,k)=>sum+(shippingByOrder.get(k)??0),0));
  if(estimatedProfit!==null)estimatedProfit=round(estimatedProfit-estimatedSellerShipping);
  const shippingTotal=shippingByOrder.size?round([...shippingByOrder.values()].reduce((a,v)=>a+v,0)):null;
  const cancelled=orders.filter(o=>['CANCELLED','CANCELED'].includes(String(o.status).toUpperCase()));
  const refundedStatus=orders.filter(o=>/REFUND/i.test(String(o.status)));
  const orderInsights={cancelledCount:cancelled.length,cancelledSubtotal:round(cancelled.filter(o=>o.currency==='USD'&&o.product_subtotal!=null).reduce((n,o)=>n+Number(o.product_subtotal),0)),refundedStatusCount:refundedStatus.length,shippingTotal,shippingAverage:shippingTotal!=null?round(shippingTotal/shippingByOrder.size):null,shippingOrderCount:shippingByOrder.size,shippingIncomplete:shippingByOrder.size<payable.length||limited};
  const bins=[...bucketMap.entries()].map(([key,b])=>({...b,key,value:round(b.value)}));
  return NextResponse.json({period,start,end:today,total,orderInsights,importedOrders:orders.length,paidOrders:payable.length,cancelledOrUnpaid:orders.filter(o=>['UNPAID','CANCELLED','CANCELED'].includes(o.status)).length,averageOrder:payable.length?round(total/payable.length):0,bins,topSellers,limited,profitEstimate:{profit:estimatedProfit,fees:round(estimatedFees),cogs:round(estimatedCOGS),pricedSales:round(pricedProductSales),pricedSkuCount,unpricedSkuCount,productLineCount,feeRate:0.06,shipping:estimatedSellerShipping,shippingCoveredOrders:coveredPricedOrderIds.length,shippingMissingOrders:Math.max(0,pricedOrderIds.size-coveredPricedOrderIds.length),shippingEstimated:shippingByOrder.size>0,partial:unpricedSkuCount>0||limited||productLineCount===0||pricedOrderIds.size!==coveredPricedOrderIds.length},recent:orders.slice(-14).reverse().map(o=>({id:o.order_id,status:o.status,subtotal:o.product_subtotal,currency:o.currency,date:o.created_at,shippingCost:shippingByOrder.get(`${o.shop_id}:${o.order_id}`)??null})),lastSync:all.reduce((a,o)=>o.synced_at&&o.synced_at>a?o.synced_at:a,'')});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load analytics'},{status:503});}
}
