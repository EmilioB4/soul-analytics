import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {payoutSiteUrl} from '../../../../../lib/payout-brand';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const origin=payoutSiteUrl(),secret=process.env.CRON_SECRET;
 if(!origin||!secret||secret.length<16)return NextResponse.json({error:'Set a CRON_SECRET of at least 16 characters and PAYOUT_APP_URL to the production https:// site address in Vercel, then redeploy. An existing Vercel production URL is also supported.'},{status:503});
 const client=db();const {data:settings,error}=await client.from('payout_alert_settings').select('enabled').eq('owner_id',user.id).maybeSingle();if(error||!settings?.enabled)return NextResponse.json({error:'Save and enable your payout notifications first.'},{status:400});
 const result=await client.rpc('configure_payout_alert_schedule',{p_url:origin+'/api/notifications/payouts/cron',p_secret:secret});if(result.error)throw Error('Run supabase/payout_notifications_fast.sql in Supabase SQL Editor first.');
 return NextResponse.json({enabled:true,intervalSeconds:60});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to configure one-minute checks.'},{status:503});}}
