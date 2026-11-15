import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../lib/tiktok';
import {walmartPayoutOwnerMatches} from '../../../lib/payout-ownership';
import {configureAutomation,queueAutomation} from '../../../lib/automation';
export const runtime='nodejs';export const maxDuration=60;
async function state(id:string){
 const client=db();const [orders,payouts,tiktok]=await Promise.all([
  client.from('order_auto_syncs').select('platform,enabled,last_success_at,last_attempt_at,last_error,last_count').eq('owner_id',id),
  client.from('payout_alert_settings').select('enabled,tiktok_enabled,walmart_enabled,last_checked_at,last_error').eq('owner_id',id).maybeSingle(),
  client.from('tiktok_connections').select('owner_id').eq('owner_id',id).maybeSingle()
 ]);
 if(orders.error||payouts.error)throw Error('Run supabase/automation_repair.sql in Supabase SQL Editor to finish background setup.');
 if(tiktok.error)throw Error('Unable to verify the TikTok connection.');
 return {jobs:orders.data||[],payouts:payouts.data,connected:{tiktok:Boolean(tiktok.data),walmart:await walmartPayoutOwnerMatches(id),whatnot:process.env.WHATNOT_OWNER_ID===id&&Boolean(process.env.WHATNOT_API_TOKEN)}};
}
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const data=await state(user.id),health=await db().rpc('automation_scheduler_health');
 return NextResponse.json({...data,health:health.error?null:health.data,repairRequired:Boolean(health.error)});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Automation status unavailable.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const current=await state(user.id);
 if(!Object.values(current.connected).some(Boolean))return NextResponse.json({error:'Connect a platform first. Walmart must be linked to this owner.'},{status:409});
 await configureAutomation();
 const client=db();const jobs=await client.from('order_auto_syncs').upsert((['tiktok','walmart','whatnot'] as const).map(platform=>({owner_id:user.id,platform,enabled:current.connected[platform]})),{onConflict:'owner_id,platform'});if(jobs.error)throw Error('Could not enable automatic order imports.');
 // Use the saved webhook; never return or replace it during activation.
 const saved=await client.from('payout_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(saved.error)throw Error('Could not inspect saved payout configuration.');
 const payoutReady=Boolean(saved.data?.webhook_encrypted)&&(current.connected.tiktok||current.connected.walmart);
 if(payoutReady){const update=await client.from('payout_alert_settings').update({enabled:true,tiktok_enabled:current.connected.tiktok,walmart_enabled:current.connected.walmart}).eq('owner_id',user.id);if(update.error)throw Error('Could not enable payout notifications.');}
 // Exercise the actual scheduled HTTP path, not the manual sync/check handlers.
 await queueAutomation('orders');if(payoutReady)await queueAutomation('payouts');
 return NextResponse.json({queued:true,payoutsEnabled:payoutReady,message:payoutReady?'Background requests queued. Waiting for the server responses to verify automatic updates.':'Order imports started. Add a Discord webhook to enable payout notifications.'});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Automatic updates could not be activated.'},{status:503});}}
