import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {accessToken,tikTokCall} from '../../../../../lib/tiktok-orders';
export const runtime='nodejs';
export const maxDuration=60;
const num=(v:unknown)=>v===undefined||v===null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const stamp=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString():null;};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
function dates(start:string|null,end:string|null){
 const iso=/^\d{4}-\d{2}-\d{2}$/;
 if(!start||!end||!iso.test(start)||!iso.test(end)||start>end)throw Error('Choose a valid start and end date');
 const low=Date.parse(start+'T00:00:00Z'),high=Date.parse(end+'T00:00:00Z')+86400000;
 if(!Number.isFinite(low)||!Number.isFinite(high)||high-low>366*86400000)throw Error('Maximum reporting window is 366 days');
 return {low,high};
}
async function authorized(req:NextRequest){
 const user=await owner(req.headers.get('authorization'));if(!user)return null;
 const database=db();
 const {data,error}=await database.from('tiktok_connections').select('owner_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,refresh_expires_at').eq('owner_id',user.id).maybeSingle();
 if(error||!data)throw Error('Connect TikTok Shop first');
 return {user,database,connection:data};
}
export async function POST(req:NextRequest){
 try{
  const ctx=await authorized(req);if(!ctx)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {start,end}=await req.json();const {low,high}=dates(start,end);
  const token=await accessToken(ctx.connection);
  const shops=await tikTokCall('/authorization/202309/shops',token);
  if(!Array.isArray(shops?.shops)||shops.shops.length!==1||!shops.shops[0]?.cipher)throw Error('Expected one authorized shop');
  const shop=shops.shops[0], shop_id=String(shop.id),shop_cipher=String(shop.cipher);
  const started=new Date().toISOString();
  let unsettled=0, payments=0, incomplete=false;
  // TikTok official estimates for orders and adjustments. Only include order-attributed rows in the order-date dashboard.
  let pageToken='';
  for(let page=0;page<10;page++){
   const params:Record<string,string>={shop_cipher,page_size:'100',sort_field:'order_create_time',sort_order:'ASC',search_time_ge:String(Math.floor(low/1000)),search_time_lt:String(Math.floor(high/1000))};
   if(pageToken)params.page_token=pageToken;
   const d=await tikTokCall('/finance/202507/orders/unsettled',token,undefined,params);
   const rows=(Array.isArray(d?.transactions)?d.transactions:[]).filter((t:any)=>t?.id&&t?.currency==='USD').map((t:any)=>({owner_id:ctx.user.id,shop_id,transaction_id:String(t.id),order_id:t.order_id?String(t.order_id):null,type:String(t.type||'UNKNOWN'),currency:'USD',order_created_at:stamp(t.order_create_time),estimated_amount:num(t.est_settlement_amount),fee_amount:num(t.est_fee_tax_amount),shipping_amount:num(t.est_shipping_cost_amount),estimated_settlement:t.estimated_settlement?String(t.estimated_settlement):null,synced_at:started}));
   if(rows.length){const {error}=await ctx.database.from('tiktok_unsettled_transactions').upsert(rows,{onConflict:'owner_id,shop_id,transaction_id'});if(error)throw Error('Cannot save unsettled amounts. Run tiktok_official_payouts.sql');}
   unsettled+=rows.length;
   pageToken=String(d?.next_page_token||'');
   if(!pageToken)break;
   if(page===9)incomplete=true;
  }
  if(!incomplete){ // Remove transactions that are no longer unsettled (e.g. settled since last sync).
   const {error}=await ctx.database.from('tiktok_unsettled_transactions').delete().eq('owner_id',ctx.user.id).eq('shop_id',shop_id).gte('order_created_at',new Date(low).toISOString()).lt('order_created_at',new Date(high).toISOString()).lt('synced_at',started);
   if(error)throw Error('Could not expire outdated unsettled estimates');
  }
  // Payment status is an independent timeline: payment creation date, not sale/stream date.
  pageToken='';
  for(let page=0;page<10;page++){
   const params:Record<string,string>={shop_cipher,page_size:'100',sort_field:'create_time',sort_order:'ASC',create_time_ge:String(Math.floor(low/1000)),create_time_lt:String(Math.floor(high/1000))};
   if(pageToken)params.page_token=pageToken;
   const d=await tikTokCall('/finance/202605/payments',token,undefined,params);
   const rows=(Array.isArray(d?.payments)?d.payments:[]).filter((p:any)=>p?.id&&p?.amount?.currency==='USD'&&num(p.amount.value)!==null&&stamp(p.create_time)).map((p:any)=>({owner_id:ctx.user.id,shop_id,payment_id:String(p.id),status:String(p.status||'UNKNOWN'),currency:'USD',amount:num(p.amount.value),settlement_amount:p.settlement_amount?.currency==='USD'?num(p.settlement_amount.value):null,created_at:stamp(p.create_time),paid_at:stamp(p.paid_time),bank_last_four:typeof p.bank_account==='string'?p.bank_account.slice(-4):null,synced_at:started}));
   if(rows.length){const {error}=await ctx.database.from('tiktok_payment_records').upsert(rows,{onConflict:'owner_id,shop_id,payment_id'});if(error)throw Error('Cannot save payments. Run tiktok_official_payouts.sql');}
   payments+=rows.length;pageToken=String(d?.next_page_token||'');
   if(!pageToken)break;
   if(page===9)incomplete=true;
  }
  return NextResponse.json({unsettled,payments,incomplete,updatedAt:started,message:incomplete?'Pagination cap reached: narrow your date range.':'Official TikTok finance data refreshed.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'TikTok payout sync failed'},{status:502});}
}
export async function GET(req:NextRequest){
 try{
  const ctx=await authorized(req);if(!ctx)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {low,high}=dates(req.nextUrl.searchParams.get('start'),req.nextUrl.searchParams.get('end'));
  const {data:shops,error:shopError}=await ctx.database.from('tiktok_orders').select('shop_id').eq('owner_id',ctx.user.id).limit(1);
  if(shopError)throw Error('Could not identify TikTok Shop');
  const shop_id=shops?.[0]?.shop_id;
  if(!shop_id)return NextResponse.json({unsettledAmount:null,unsettledOrders:0,adjustments:0,payments:[],paidTotal:null,pendingTotal:null,lastSync:null});
  const [u,p]=await Promise.all([
   ctx.database.from('tiktok_unsettled_transactions').select('transaction_id,order_id,type,estimated_amount,currency,synced_at').eq('owner_id',ctx.user.id).eq('shop_id',shop_id).gte('order_created_at',new Date(low).toISOString()).lt('order_created_at',new Date(high).toISOString()).limit(2000),
   ctx.database.from('tiktok_payment_records').select('payment_id,status,amount,currency,created_at,paid_at,bank_last_four,synced_at').eq('owner_id',ctx.user.id).eq('shop_id',shop_id).gte('created_at',new Date(low).toISOString()).lt('created_at',new Date(high).toISOString()).order('created_at',{ascending:false}).limit(2000)
  ]);
  if(u.error||p.error)throw Error('Run tiktok_official_payouts.sql before loading TikTok payout data');
  const unresolved=(u.data||[]).filter(x=>x.currency==='USD'&&x.estimated_amount!==null);
  const orders=unresolved.filter(x=>x.type==='ORDER'&&x.order_id);
  const adjustments=unresolved.filter(x=>x.type!=='ORDER');
  const payments=(p.data||[]).filter(x=>x.currency==='USD');
  const paid=payments.filter(x=>x.status==='PAID');const processing=payments.filter(x=>x.status==='PROCESSING');
  const synced=[...unresolved,...payments].map(x=>x.synced_at).sort().reverse()[0]||null;
  return NextResponse.json({unsettledAmount:orders.length?round(orders.reduce((n,x)=>n+Number(x.estimated_amount),0)):null,unsettledOrders:new Set(orders.map(x=>x.order_id)).size,unsettledAdjustmentAmount:adjustments.length?round(adjustments.reduce((n,x)=>n+Number(x.estimated_amount),0)):null,paidTotal:paid.length?round(paid.reduce((n,x)=>n+Number(x.amount),0)):null,processingTotal:processing.length?round(processing.reduce((n,x)=>n+Number(x.amount),0)):null,payments:payments.slice(0,25).map(x=>({id:x.payment_id,status:x.status,amount:x.amount,date:x.created_at,paidAt:x.paid_at,bankLastFour:x.bank_last_four})),lastSync:synced,truncated:(u.data||[]).length>=2000||(p.data||[]).length>=2000});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load payout data'},{status:503});}
}
