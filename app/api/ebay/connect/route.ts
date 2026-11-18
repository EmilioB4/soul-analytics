import {randomBytes,createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {ebayAuthorizationUrl,ebayConfig} from '../../../../lib/ebay-config';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.nextUrl?.origin&&req.nextUrl.origin!==ebayConfig().origin)return NextResponse.json({error:'The eBay callback address does not match this site. Ask the administrator to check the app URL before connecting.'},{status:409});
 const state=randomBytes(32).toString('hex'),url=ebayAuthorizationUrl(state);encrypt('configuration-check');
 const client=db();await client.from('ebay_oauth_states').delete().eq('owner_id',user.id);
 const result=await client.from('ebay_oauth_states').insert({owner_id:user.id,state_hash:createHash('sha256').update(state).digest('hex'),expires_at:new Date(Date.now()+600000).toISOString()});if(result.error)throw Error('Run supabase/ebay_setup.sql in this website’s Supabase project first.');
 const response=NextResponse.json({url});response.cookies.set('soul_ebay_oauth',state,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/ebay',maxAge:600});return response;
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'eBay connection unavailable.'},{status:503});}}
