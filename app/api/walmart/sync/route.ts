import {NextRequest,NextResponse} from 'next/server';
import {syncRequestOwner} from '../../../../lib/order-sync-auth';
import {db} from '../../../../lib/tiktok';
import {newYorkMidnight} from '../../../../lib/walmart-period';
import {walmartOrderDate,walmartOrdersUrl} from '../../../../lib/walmart';
export const runtime='nodejs';
export const maxDuration=60;
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Obj:{};
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x:x==null?[]:[x];
const str=(x:unknown)=>String(x??'');
const money=(x:unknown)=>{const v=obj(x);const n=Number(v.amount??v.value??x);return Number.isFinite(n)?n:0;};
const errorText=(x:unknown)=>JSON.stringify(x).slice(0,700);
export async function POST(req:NextRequest){
 try{
  const user=await syncRequestOwner(req,'walmart');
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=process.env.WALMART_CLIENT_ID,secret=process.env.WALMART_CLIENT_SECRET;
  if(!id||!secret)return NextResponse.json({error:'Missing WALMART_CLIENT_ID or WALMART_CLIENT_SECRET in Vercel.'},{status:503});
  const tokenRes=await fetch('https://marketplace.walmartapis.com/v3/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID()},body:'grant_type=client_credentials',cache:'no-store'});
  const tokenBody:unknown=await tokenRes.json().catch(()=>({message:'Unparseable token response'}));
  if(!tokenRes.ok)return NextResponse.json({error:`Walmart authentication HTTP ${tokenRes.status}: ${errorText(tokenBody)}`},{status:502});
  const token=str(obj(tokenBody).access_token||obj(obj(obj(tokenBody).clientCredentialsRes).value).access_token);
  if(!token)return NextResponse.json({error:`Walmart authentication returned no access token. Response fields: ${Object.keys(obj(tokenBody)).join(', ')}`},{status:502});
  const input=await req.json().catch(()=>({}));const validDate=(x:unknown)=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  if((input.startDate&&!validDate(input.startDate))||(input.endDate&&!validDate(input.endDate))||(input.startDate&&input.endDate&&input.startDate>input.endDate))return NextResponse.json({error:'Invalid sync date range.'},{status:400});
  const since=input.startDate?newYorkMidnight(input.startDate):new Date(Date.now()-89*86400000).toISOString();
  const dayAfter=input.endDate?new Date(Date.parse(input.endDate)+86400000).toISOString().slice(0,10):null;const until=dayAfter?new Date(Date.parse(newYorkMidnight(dayAfter))-1).toISOString():null;
  const diagnostics:{dateRange:string;pages:number;responseShapes:string[];rawOrders:number;skippedOrders:number;skippedLines:number;nextCursorPresent:boolean}={dateRange:`${since} to ${until||'now'}`,pages:0,responseShapes:[],rawOrders:0,skippedOrders:0,skippedLines:0,nextCursorPresent:false};
  const rows:Obj[]=[];
  const fulfillmentCounts:Record<string,number>={};
  let incomplete=false;
  for(const shipNodeType of ['SellerFulfilled','WFSFulfilled'] as const){
  let cursor='';
  fulfillmentCounts[shipNodeType]=0;
  for(let page=0;page<15;page++){
   const url=walmartOrdersUrl(since,cursor,shipNodeType);if(!cursor&&until)url.searchParams.set('createdEndDate',until);
   const res=await fetch(url.toString(),{headers:{'WM_SEC.ACCESS_TOKEN':token,'WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID(),Accept:'application/json'},cache:'no-store'});
   const body:unknown=await res.json().catch(async()=>({raw:(await res.text().catch(()=>'' )).slice(0,400)}));
   if(!res.ok)return NextResponse.json({error:`Walmart orders HTTP ${res.status}: ${errorText(body)}`,diagnostics},{status:502});
   diagnostics.pages++;
   const root=obj(body),list=obj(root.list),elements=obj(list.elements);
   if(page===0)diagnostics.responseShapes=[`root: ${Object.keys(root).join(', ')}`,`list: ${Object.keys(list).join(', ')}`,`elements: ${Object.keys(elements).join(', ')}`];
   const rawOrders=arr(elements.order??list.order??obj(root.orders).order??root.orders);
   diagnostics.rawOrders+=rawOrders.length;
   fulfillmentCounts[shipNodeType]+=rawOrders.length;
   for(const raw of rawOrders){
    const order=obj(raw),po=str(order.purchaseOrderId||order.customerOrderId);
    const date=walmartOrderDate(order.orderDate??order.createdDate);
    if(!po||!date){diagnostics.skippedOrders++;continue;}
    const lines=arr(obj(order.orderLines).orderLine??order.orderLine);
    for(let index=0;index<lines.length;index++){
     const line=obj(lines[index]),item=obj(line.item);
     const qty=Number(obj(line.orderLineQuantity).amount??line.quantity??1);
     if(!Number.isFinite(qty)||qty<=0){diagnostics.skippedLines++;continue;}
     const statuses=arr(obj(line.orderLineStatuses).orderLineStatus);
     const cancelled=statuses.length>0&&statuses.every(s=>str(obj(s).status).toLowerCase().includes('cancel'));
     if(cancelled)continue;
     const charges=arr(obj(line.charges).charge);
     const price=charges.filter(c=>str(obj(c).chargeType).toUpperCase()==='PRODUCT').reduce((sum:number,c:unknown)=>sum+money(obj(c).chargeAmount),0);
     const method=str(obj(order.shipNode).type||order.fulfillmentMethod||line.fulfillmentMethod||obj(order.shippingInfo).fulfillmentMethod||obj(order.shippingInfo).fulfillmentType||shipNodeType).toUpperCase();
     const fulfillment=method.includes('WFS')||method.includes('WALMART')?'WFS':method.includes('SELLER')?'SF':'Unknown';
     rows.push({owner_id:user.id,order_id:po,line_id:str(line.lineNumber??index+1),order_date:date,sku:str(item.sku||line.sku||'UNKNOWN'),product_name:str(item.productName||item.sku||'Unknown product'),fulfillment,quantity:qty,revenue:price});
    }
   }
   const meta=obj(list.meta??root.meta);
   const next=str(meta.nextCursor??meta.next??'');
   diagnostics.nextCursorPresent=Boolean(next);
   if(!next||next===cursor)break;
   cursor=next;
  }
  incomplete ||= diagnostics.nextCursorPresent;
  }
  const syncDiagnostics={...diagnostics,fulfillmentCounts,nextCursorPresent:incomplete};
  if(diagnostics.rawOrders===0){
   return NextResponse.json({orders:0,lines:0,feeSync:false,warning:'Walmart returned zero orders for the requested sync range. No records were imported. Check the date range and the response shape below.',diagnostics:syncDiagnostics});
  }
  if(rows.length===0)return NextResponse.json({orders:diagnostics.rawOrders,lines:0,feeSync:false,warning:'Walmart returned orders, but none produced importable lines. See diagnostics.',diagnostics:syncDiagnostics});
  const database=db();
  for(let i=0;i<rows.length;i+=200){const {error}=await database.from('walmart_sales').upsert(rows.slice(i,i+200),{onConflict:'owner_id,order_id,line_id'});if(error)throw Error(`Walmart database save failed: ${error.message}`);}
  return NextResponse.json({orders:diagnostics.rawOrders,lines:rows.length,feeSync:false,diagnostics:syncDiagnostics,...(incomplete?{warning:'Reached the 15-page limit for a fulfillment type. More Walmart orders remain; the import is incomplete.'}:{}),note:'WFS settlement fees are not imported by this endpoint.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Walmart sync failed'},{status:502});}
}
