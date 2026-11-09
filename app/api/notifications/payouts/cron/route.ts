import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/tiktok';
import {checkPayoutAlerts} from '../../../../../lib/payout-alerts';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized'},{status:401});try{
 const {data,error}=await db().from('payout_alert_settings').select('owner_id').eq('enabled',true).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(1);if(error)throw Error('Install payout notification database setup first.');
 const results=[];for(const row of data||[])results.push(await checkPayoutAlerts(row.owner_id));return NextResponse.json({results});
}catch{return NextResponse.json({error:'Scheduled payout check failed. Check notification settings and database setup.'},{status:503});}}
