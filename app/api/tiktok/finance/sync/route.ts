import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {accessToken,tikTokCall} from '../../../../../lib/tiktok-orders';
export const runtime='nodejs';
export const maxDuration=60;
// Deliberately bounded. A statement API returns ONLY settled orders; missing records
// must not be interpreted as zero fees or zero settlement.
export async function POST(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const client=db();
  const {data:connection,error:connectionError}=await client.from('tiktok_connections').select('owner_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,refresh_expires_at').eq('owner_id',user.id).maybeSingle();
  if(connectionError||!connection)return NextResponse.json({error:'TikTok authorization missing'},{status:409});
  const token=await accessToken(connection);
  const shops=await tikTokCall('/authorization/202309/shops',token);
  if(!Array.isArray(shops?.shops)||shops.shops.length!==1||!shops.shops[0]?.cipher)return NextResponse.json({error:'Expected one authorized shop'},{status:409});
  const shop=shops.shops[0];
  const {data:orders,error}=await client.from('tiktok_orders').select('order_id,shop_id,status,created_at').eq('owner_id',user.id).eq('shop_id',String(shop.id)).order('created_at',{ascending:false}).limit(150);
  if(error)throw Error('Could not list imported orders');
  const {data:done,error:doneError}=await client.from('tiktok_order_finance').select('order_id').eq('owner_id',user.id).eq('shop_id',String(shop.id)).limit(5000);
  if(doneError)throw Error('Finance table missing. Run product_finance.sql');
  const known=new Set((done||[]).map(x=>x.order_id));
  const candidates=(orders||[]).filter(o=>!known.has(o.order_id)&&!['UNPAID','CANCELLED'].includes(o.status)).slice(0,15);
  let imported=0,notSettled=0;
  const amount=(v:unknown)=>v===undefined||v===null||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
  for(const o of candidates){
   let data:Record<string,unknown>;
   try{data=await tikTokCall(`/finance/202501/orders/${encodeURIComponent(o.order_id)}/statement_transactions`,token,undefined,{shop_cipher:String(shop.cipher)});}
   catch(e){
    // Distinguish a missing/not-yet-settled record from permission or API failures.
    const msg=e instanceof Error?e.message:'Finance API error';
    if(/not settled|not found|no (statement|transaction)/i.test(msg)){notSettled++;continue;}
    throw Error(`Finance API for order ${o.order_id}: ${msg}`);
   }
   const settlement=amount(data?.settlement_amount);
   if(settlement===null){notSettled++;continue;}
   const row={owner_id:user.id,shop_id:String(shop.id),order_id:o.order_id,currency:String(data.currency||'USD'),revenue_amount:amount(data.revenue_amount),fee_and_tax_amount:amount(data.fee_and_tax_amount),shipping_cost_amount:amount(data.shipping_cost_amount),settlement_amount:settlement,settled_at:new Date().toISOString()};
   const {error:upsertError}=await client.from('tiktok_order_finance').upsert(row,{onConflict:'owner_id,shop_id,order_id'});
   if(upsertError)throw Error('Unable to save finance data. Run product_finance.sql');
   imported++;
  }
  return NextResponse.json({processed:candidates.length,imported,notSettled,message:'Settled finance import complete for this batch. Retry later for unsettled orders. Only the newest 150 orders are considered per request.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Finance sync failed'},{status:502});}
}
