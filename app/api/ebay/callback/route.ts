import {createHash,timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db,encrypt} from '../../../../lib/tiktok';
import {ebayConfig} from '../../../../lib/ebay-config';
import {ebayTokenRequest,ebayGet} from '../../../../lib/ebay-api';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 let origin:string;try{origin=ebayConfig().origin;}catch{return NextResponse.json({error:'eBay administrator setup is incomplete.'},{status:503});}
 const redirect=(status:string)=>{const response=NextResponse.redirect(origin+'/?ebay='+status);response.cookies.set('soul_ebay_oauth','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/ebay',maxAge:0});return response;};
 const state=req.nextUrl.searchParams.get('state')||'',cookie=req.cookies.get('soul_ebay_oauth')?.value||'';
 if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(cookie)||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))return redirect('invalid-session');
 try{
  const client=db(),claimed=await client.rpc('consume_ebay_oauth_state',{p_hash:createHash('sha256').update(state).digest('hex')});if(claimed.error||!claimed.data)return redirect('invalid-session');const ownerId=String(claimed.data);
  if(req.nextUrl.searchParams.get('error'))return redirect('cancelled');
  const code=req.nextUrl.searchParams.get('code');if(!code||code.length>10000)return redirect('failed');
  const token=await ebayTokenRequest({grant_type:'authorization_code',code,redirect_uri:ebayConfig().ruName});
  if(typeof token.refresh_token!=='string'||!Number.isFinite(token.refresh_token_expires_in)||token.refresh_token_expires_in<=0)return redirect('failed');
  const identity=await ebayGet('https://apiz.ebay.com/commerce/identity/v1/user/',token.access_token);
  if(typeof identity.userId!=='string'||!identity.userId)return redirect('failed');
  const result=await client.rpc('save_ebay_connection',{p_owner:ownerId,p_account:identity.userId,p_username:typeof identity.username==='string'?identity.username:identity.userId,p_access:encrypt(token.access_token),p_refresh:encrypt(token.refresh_token),p_access_expiry:new Date(Date.now()+token.expires_in*1000).toISOString(),p_refresh_expiry:new Date(Date.now()+token.refresh_token_expires_in*1000).toISOString()});
  return redirect(result.error?'save-failed':'connected');
 }catch{return redirect('failed');}
}
