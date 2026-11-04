import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {accessToken,tikTokCall,orderRow,TikTokOrder} from '../../../../../lib/tiktok-orders';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
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
  // Bounded, manual 30-day backfill; no unattended scheduler or infinite pagination.
  for(let page=0;page<10;page++){
   const args:Record<string,string>={shop_cipher:String(shop.cipher),page_size:'100',sort_field:'create_time',sort_order:'DESC'};
   if(pageToken)args.page_token=pageToken;
   const result=await tikTokCall('/order/202309/orders/search',token,{create_time_ge:start,create_time_lt:end},args);
   const orders:TikTokOrder[]=result?.orders||[];
   const rows=orders.filter(o=>!!o.id).map(o=>orderRow(o,user.id,String(shop.id)));
   if(rows.length){
    const {error}=await client.from('tiktok_orders').upsert(rows,{onConflict:'owner_id,shop_id,order_id'});
    if(error)throw Error('Cannot save orders. Run the bundled tiktok_orders.sql migration first.');
   }
   total+=rows.length;pages++;
   pageToken=String(result?.next_page_token||'');
   if(!pageToken){complete=true;break;}
  }
  return NextResponse.json({imported:total,pages,complete,shopName:String(shop.name||'TikTok Shop'),message:complete?'30-day order import completed':'First 1,000 orders imported. More pages remain.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Order sync failed'},{status:502})}
}
