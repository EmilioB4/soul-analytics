import {db} from './tiktok';
import {accessToken,tikTokCall} from './tiktok-orders';
import {walmartAccessToken,walmartReport} from './walmart-api';
import {tiktokPayoutEvents,walmartPayoutEvents} from './payout-events';
export async function collectPayouts(ownerId:string,platform:'tiktok'|'walmart'){
 if(platform==='walmart'){
  if(process.env.WALMART_OWNER_ID!==ownerId)throw Error('Set WALMART_OWNER_ID to the owner of the connected Walmart account.');
  return walmartPayoutEvents(await walmartReport('/v3/report/payment/statement',await walmartAccessToken(),'payment statements'));
 }
 const {data,error}=await db().from('tiktok_connections').select('*').eq('owner_id',ownerId).maybeSingle();if(error||!data)throw Error('Connect TikTok Shop before checking payouts.');
 const token=await accessToken(data),shops=await tikTokCall('/authorization/202309/shops',token);
 if(!Array.isArray(shops?.shops)||shops.shops.length!==1||!shops.shops[0]?.cipher||!shops.shops[0]?.id)throw Error('Expected one authorized TikTok Shop.');
 const shop=shops.shops[0],rows:unknown[]=[],seen=new Set<string>();let cursor='';const started=Date.now();
 for(let page=0;page<10;page++){
  if(Date.now()-started>30000)throw Error('TikTok payment check incomplete; retry.');
  const result=await tikTokCall('/finance/202605/payments',token,undefined,{shop_cipher:String(shop.cipher),page_size:'100',sort_field:'create_time',sort_order:'ASC',create_time_ge:String(Math.floor(Date.now()/1000)-90*86400),create_time_lt:String(Math.floor(Date.now()/1000)),...(cursor?{page_token:cursor}:{})});
  if(!Array.isArray(result?.payments))throw Error('TikTok payment response is unrecognized.');rows.push(...result.payments);
  cursor=String(result.next_page_token||'');if(!cursor)return tiktokPayoutEvents(rows,String(shop.id));if(seen.has(cursor))throw Error('Repeated TikTok payment cursor.');seen.add(cursor);
 }throw Error('TikTok payment pagination incomplete; no alerts generated.');
}
