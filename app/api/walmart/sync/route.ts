import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
export const runtime='nodejs';
export const maxDuration=60;
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj=>x&&typeof x==='object'?x as Obj:{};
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x:[];
const str=(x:unknown)=>String(x??'');
const amount=(x:unknown)=>Number(obj(x).amount??x??0)||0;
export async function POST(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=process.env.WALMART_CLIENT_ID,secret=process.env.WALMART_CLIENT_SECRET;
  if(!id||!secret)return NextResponse.json({error:'Walmart credentials are missing from Vercel environment variables.'},{status:503});
  const tokenRes=await fetch('https://marketplace.walmartapis.com/v3/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID()},body:'grant_type=client_credentials',cache:'no-store'});
  if(!tokenRes.ok)throw Error(`Walmart authentication failed (${tokenRes.status}). Check API credentials and permissions.`);
  const tokenJson=await tokenRes.json();const token=str(tokenJson.access_token||obj(obj(tokenJson.clientCredentialsRes).value).access_token);
  if(!token)throw Error('Walmart did not return an access token.');
  const since=new Date(Date.now()-89*86400000).toISOString();
  const rows:Obj[]=[];let orders=0;let nextUrl=`https://marketplace.walmartapis.com/v3/orders?createdStartDate=${encodeURIComponent(since)}&limit=200`;
  const visited=new Set<string>();
  for(let page=0;page<15&&nextUrl;page++){
   if(visited.has(nextUrl))break;visited.add(nextUrl);
   const res=await fetch(nextUrl,{headers:{'WM_SEC.ACCESS_TOKEN':token,'WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID(),Accept:'application/json'},cache:'no-store'});
   if(!res.ok)throw Error(`Walmart orders request failed (${res.status}): ${String(await res.text()).slice(0,200)}`);
   const body=obj(await res.json());const list=obj(body.list);const elements=obj(list.elements);
   const items=arr(elements.order).length?arr(elements.order):arr(body.orders);
   orders+=items.length;
   for(const raw of items){const order=obj(raw);const po=str(order.purchaseOrderId||order.customerOrderId);const created=str(order.orderDate||order.createdDate);const date=created.slice(0,10);if(!po||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const lines=arr(obj(order.orderLines).orderLine);
    for(let index=0;index<lines.length;index++){const line=obj(lines[index]);const item=obj(line.item);const charges=arr(obj(line.charges).charge);const price=charges.filter(c=>str(obj(c).chargeType).toUpperCase()==='PRODUCT').reduce<number>((total,c)=>total+amount(obj(c).chargeAmount),0);const qty=Number(obj(line.orderLineQuantity).amount)||1;
     const status=str(obj(arr(obj(line.orderLineStatuses).orderLineStatus)[0]).status).toLowerCase();if(status==='cancelled')continue;
     const methodText=str(order.fulfillmentMethod||line.fulfillmentMethod||obj(order.shippingInfo).fulfillmentMethod).toUpperCase();const fulfillment=methodText.includes('WFS')||methodText.includes('WALMART')?'WFS':methodText.includes('SELLER')?'SF':'Unknown';
     rows.push({owner_id:user.id,order_id:po,line_id:str(line.lineNumber||index+1),order_date:date,sku:str(item.sku||line.sku||'UNKNOWN'),product_name:str(item.productName||item.productNameValue||item.sku||'Unknown product'),fulfillment,quantity:qty,revenue:price});
    }
   }
   const meta=obj(list.meta);const next=str(meta.nextCursor||meta.next);if(!next)break;
   const nextPage=new URL('https://marketplace.walmartapis.com/v3/orders');nextPage.searchParams.set('nextCursor',next);nextPage.searchParams.set('limit','200');nextUrl=nextPage.toString();
  }
  const database=db();for(let i=0;i<rows.length;i+=200){const {error}=await database.from('walmart_sales').upsert(rows.slice(i,i+200),{onConflict:'owner_id,order_id,line_id'});if(error)throw Error(`Walmart database: ${error.message}`);}
  return NextResponse.json({orders,lines:rows.length,feeSync:false,note:'WFS settlement charges are not imported by this orders endpoint.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Walmart sync failed'},{status:502});}
}
