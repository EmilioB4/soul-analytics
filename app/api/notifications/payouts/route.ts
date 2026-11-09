import {NextRequest,NextResponse} from 'next/server';
import {walmartPayoutOwnerMatches} from '../../../../lib/payout-ownership';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {discordWebhookUrl} from '../../../../lib/payout-events';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await db().from('payout_alert_settings').select('enabled,tiktok_enabled,walmart_enabled,last_checked_at,last_error').eq('owner_id',user.id).maybeSingle();if(error)throw Error('Run supabase/payout_notifications.sql in Supabase SQL Editor.');
 const recent=await db().from('payout_alert_events').select('platform,stage,state,amount,event_date,updated_at').eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(10);if(recent.error)throw Error('Could not load notification history.');
 let fastChecks=false;try{const schedule=await db().rpc('payout_alert_schedule_status');fastChecks=!schedule.error&&schedule.data===true;}catch{}
 return NextResponse.json({userId:user.id,configured:Boolean(data),settings:data,history:recent.data||[],fastChecks,walmartOwnerConfigured:await walmartPayoutOwnerMatches(user.id),cadence:fastChecks?'Every minute through Supabase':'Daily background checks; one-minute scheduler not enabled',whatnot:'Unsupported: the documented integration does not expose a withdrawable balance or payout-status endpoint.'});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Settings unavailable'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json();for(const key of ['enabled','tiktok_enabled','walmart_enabled'])if(typeof body[key]!=='boolean')return NextResponse.json({error:'Invalid alert preferences.'},{status:400});
 const client=db();const prior=await client.from('payout_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(prior.error)throw Error('Install supabase/payout_notifications.sql first.');
 let secret=prior.data?.webhook_encrypted;
 if(body.webhook){if(typeof body.webhook!=='string')return NextResponse.json({error:'Invalid Discord webhook.'},{status:400});try{secret=encrypt(discordWebhookUrl(body.webhook));}catch{return NextResponse.json({error:'Use a valid Discord webhook URL and configure TIKTOK_TOKEN_ENCRYPTION_KEY in Vercel.'},{status:400});}}
 if(!secret)return NextResponse.json({error:'Enter a Discord webhook URL.'},{status:400});
 if(body.enabled&&!body.tiktok_enabled&&!body.walmart_enabled)return NextResponse.json({error:'Select at least one supported platform.'},{status:400});
 if(body.walmart_enabled&&!await walmartPayoutOwnerMatches(user.id))return NextResponse.json({error:'Set WALMART_OWNER_ID in Vercel to your signed-in Supabase user ID before enabling Walmart.'},{status:400});
 const {error}=await client.from('payout_alert_settings').upsert({owner_id:user.id,webhook_encrypted:secret,enabled:body.enabled,tiktok_enabled:body.tiktok_enabled,walmart_enabled:body.walmart_enabled});if(error)throw Error('Could not save alert settings.');
 return NextResponse.json({saved:true});
}catch{return NextResponse.json({error:'Could not save settings. Check database setup and encryption configuration.'},{status:503});}}
