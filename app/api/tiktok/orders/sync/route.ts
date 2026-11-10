import {NextRequest,NextResponse} from 'next/server';
import {syncRequestOwner} from '../../../../../lib/order-sync-auth';
import {db} from '../../../../../lib/tiktok';
import {accessToken,tikTokCall,orderRow,TikTokOrder} from '../../../../../lib/tiktok-orders';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest){
 try{
  const user=await syncRequestOwner(req,'tiktok');
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const client=db();
  const {data:connection,error:connectionError}=await client.from('tiktok_connections').select('owner_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,refresh_expires_at').eq('owner_id',user.id).maybeSingle();
  if(connectionError||!connection)return NextResponse.json({error:'TikTok Shop is not authorized'},{status:409});
  const token=await accessToken(connection);
  const shops=await tikTokCall('/authorization/202309/shops',token);
  const available=shops?.shops;
  if(!Array.isArray(available)||available.length!==1||!available[0]?.cipher||!available[0]?.id)return NextResponse.json({error:'Expected exactly one authorized TikTok shop. Contact support before syncing multiple shops.'},{status:409});
  const shop=available[0];
  const start=Math.floor(Date.now()/1000)-30*86400;
  const end=Math.floor(Date.now()/1000)+60;
  let pageToken='';let total=0;let pages=0;let complete=false;
  // Shared manual/background 30-day overlap; stable IDs make repeated imports idempotent.
  for(let page=0;page<10;page++){
   const args:Record<string,string>={shop_cipher:String(shop.cipher),page_size:'100',sort_field:'create_time',sort_order:'DESC'};
   if(pageToken)args.page_token=pageToken;
   const result=await tikTokCall('/order/202309/orders/search',token,{create_time_ge:start,create_time_lt:end},args);
   if(!Array.isArray(result?.orders))throw Error('Unrecognized TikTok order response; sync incomplete.');
   const orders:TikTokOrder[]=result.orders;
   const rows=orders.filter(o=>!!o.id).map(o=>orderRow(o,user.id,String(shop.id)));
   if(rows.length){
    const {error}=await client.from('tiktok_orders').upsert(rows,{onConflict:'owner_id,shop_id,order_id'});
    if(error)throw Error('Cannot save orders. Run the bundled tiktok_orders.sql migration first.');
   }
   // Import the SKU-level records needed for editable product costs.
   // Each line has its own stable TikTok identifier.
   const lines=orders.flatMap(o=>(Array.isArray((o as any).line_items)?(o as any).line_items:[]).filter((l:any)=>l&&l.id&&l.sku_id).map((l:any)=>({
    owner_id:user.id,shop_id:String(shop.id),order_id:String(o.id),line_id:String(l.id),
    sku_id:String(l.sku_id),product_id:l.product_id?String(l.product_id):null,
    product_name:String(l.product_name||'Unnamed product'),sku_name:l.sku_name?String(l.sku_name):null,
    sku_image:typeof l.sku_image==='string'&&l.sku_image.startsWith('https://')?l.sku_image:null,
    // TikTok order lines usually represent a single unit; use documented quantity if available.
    quantity:Number.isSafeInteger(Number(l.quantity))&&Number(l.quantity)>0?Number(l.quantity):1,
    unit_sale_price:l.sale_price==null||!Number.isFinite(Number(l.sale_price))?null:Number(l.sale_price),
    currency:String(o.payment?.currency||'USD'),synced_at:new Date().toISOString()
   })));
   if(lines.length){
    const {error:lineError}=await client.from('tiktok_order_items').upsert(lines,{onConflict:'owner_id,shop_id,order_id,line_id'});
    if(lineError)throw Error('Could not save order product lines. Run product_finance.sql before syncing.');
   }
   total+=rows.length;pages++;
   pageToken=String(result?.next_page_token||'');
   if(!pageToken){complete=true;break;}
  }
  return NextResponse.json({imported:total,pages,complete,shopName:String(shop.name||'TikTok Shop'),message:complete?'30-day order import completed':'First 1,000 orders imported. More pages remain.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Order sync failed'},{status:502})}
}
