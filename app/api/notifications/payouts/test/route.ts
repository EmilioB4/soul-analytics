import {NextRequest,NextResponse} from 'next/server';
import {payoutTestMessage} from '../../../../../lib/payout-events';
import {payoutSiteUrl} from '../../../../../lib/payout-brand';
import {owner,db} from '../../../../../lib/tiktok';
import {decrypt} from '../../../../../lib/tiktok-orders';
import {sendDiscord} from '../../../../../lib/payout-alerts';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data,error}=await db().from('payout_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(error||!data)throw Error('Save your webhook in Integrations first.');
 const delivery=await sendDiscord(decrypt(data.webhook_encrypted),payoutTestMessage({siteUrl:payoutSiteUrl()}));
 if(delivery.state!=='sent')return NextResponse.json({error:delivery.state==='retry'?'Discord is rate-limited or temporarily unavailable. Try the test later.':'Delivery could not be confirmed. Check the channel before testing again.'},{status:502});
 return NextResponse.json({sent:true});
}catch{return NextResponse.json({error:'Test failed. Check the saved Discord webhook and database setup.'},{status:503});}}
