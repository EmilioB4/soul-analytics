import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {payoutSiteUrl} from '../../../../lib/payout-brand';
import {walmartPayoutOwnerMatches} from '../../../../lib/payout-ownership';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db(),rows=await client.from('order_auto_syncs').select('platform,enabled,last_attempt_at,last_success_at,last_error,last_count').eq('owner_id',user.id);if(rows.error)throw Error('Run supabase/order_auto_sync.sql in Supabase first.');
 const scheduled=await client.rpc('order_auto_sync_status');if(scheduled.error)throw Error('Order sync scheduler setup is incomplete.');
 return NextResponse.json({jobs:rows.data||[],scheduled:scheduled.data===true,walmartReady:await walmartPayoutOwnerMatches(user.id),whatnotReady:process.env.WHATNOT_OWNER_ID===user.id});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Automatic sync unavailable.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json(),platforms=['tiktok','walmart','whatnot'] as const;
 if(!body.enabled||typeof body.enabled!=='object'||platforms.some(p=>typeof body.enabled[p]!=='boolean'))return NextResponse.json({error:'Choose valid platform preferences.'},{status:400});
 if(body.enabled.walmart&&!await walmartPayoutOwnerMatches(user.id))return NextResponse.json({error:'Link your Walmart account under Payout alerts first.'},{status:409});
 if(body.enabled.whatnot&&process.env.WHATNOT_OWNER_ID!==user.id)return NextResponse.json({error:'Configure WHATNOT_OWNER_ID for your connected Whatnot account in Vercel first.'},{status:409});
 const client=db();if(platforms.some(p=>body.enabled[p])){
  const origin=payoutSiteUrl(),secret=process.env.CRON_SECRET;
  if(!origin||!secret||secret.length<16)return NextResponse.json({error:'Configure CRON_SECRET and a production PAYOUT_APP_URL (or Vercel production hostname), then redeploy.'},{status:503});
  const schedule=await client.rpc('configure_order_auto_sync',{p_url:origin+'/api/orders/auto-sync/cron',p_secret:secret});if(schedule.error)throw Error('Install supabase/order_auto_sync.sql first.');
 }
 const saved=await client.from('order_auto_syncs').upsert(platforms.map(platform=>({owner_id:user.id,platform,enabled:body.enabled[platform]})),{onConflict:'owner_id,platform'});if(saved.error)throw Error('Could not save automatic sync preferences.');
 return NextResponse.json({saved:true,intervalMinutes:5});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not configure automatic order sync.'},{status:503});}}
