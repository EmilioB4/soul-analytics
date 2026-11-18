import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {ebayAccessToken,ebayGet} from '../../../../lib/ebay-api';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const connection=await ebayAccessToken(user.id);
 const identity=await ebayGet('https://apiz.ebay.com/commerce/identity/v1/user/',connection.token);
 if(identity.userId!==connection.accountId)return NextResponse.json({error:'The authorized eBay seller does not match this connection. Reconnect before importing.'},{status:409});
 return NextResponse.json({verified:true,username:typeof identity.username==='string'?identity.username:connection.accountId,checkedAt:new Date().toISOString()});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'eBay verification failed.'},{status:503});}}
