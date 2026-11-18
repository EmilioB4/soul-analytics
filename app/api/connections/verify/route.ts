import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {walmartAccessToken} from '../../../../lib/walmart-api';
import {whatnotToken,whatnotConnection,verifyWhatnotToken} from '../../../../lib/whatnot-connections';
import {accessToken,tikTokCall} from '../../../../lib/tiktok-orders';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const input=await req.json();if(!['walmart','tiktok','whatnot'].includes(input.platform))return NextResponse.json({error:'Choose a supported marketplace.'},{status:400});
 let message='';
 if(input.platform==='walmart'){await walmartAccessToken(user.id);message='Walmart credentials are valid. Order and report permissions are checked when you sync.';}
 if(input.platform==='whatnot'){
  const identity=await verifyWhatnotToken(await whatnotToken(user.id)),connection=await whatnotConnection(user.id);
  if(connection.saved&&connection.saved.seller_id!==identity.id)return NextResponse.json({error:'The Whatnot seller does not match this saved connection. Reconnect before importing.'},{status:409});
  message='Whatnot authorization verified for '+identity.username+'. Report permissions are checked when you sync.';
 }
 if(input.platform==='tiktok'){
  const connection=await db().from('tiktok_connections').select('*').eq('owner_id',user.id).single();if(connection.error||!connection.data)return NextResponse.json({error:'Connect TikTok Shop first.'},{status:409});
  const token=await accessToken(connection.data),data=await tikTokCall('/authorization/202309/shops',token);
  if(!Array.isArray(data?.shops)||!data.shops.length)return NextResponse.json({error:'TikTok returned no authorized shops. Reconnect and approve your shop.'},{status:409});
  message='TikTok Shop authorization is working. Your shop is available for importing.';
 }
 return NextResponse.json({verified:true,message,checkedAt:new Date().toISOString()});
}catch{return NextResponse.json({error:'Connection verification failed. Reconnect or check the token expiration, app setup and marketplace permissions.'},{status:503});}}
