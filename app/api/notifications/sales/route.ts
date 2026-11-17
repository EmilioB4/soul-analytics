import {NextRequest,NextResponse} from 'next/server';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {decrypt} from '../../../../lib/tiktok-orders';
import {discordWebhookUrl,maskedDiscordWebhook} from '../../../../lib/payout-events';
import {walmartPayoutOwnerMatches} from '../../../../lib/payout-ownership';
import {automationConfig} from '../../../../lib/automation';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db();const settings=await client.from('walmart_sale_alert_settings').select('enabled,enabled_at,webhook_encrypted,initialized_at,last_attempt_at,last_success_at,last_error').eq('owner_id',user.id).maybeSingle();
 if(settings.error)throw Error('Run supabase/walmart_sale_alerts.sql in Supabase SQL Editor first.');
 const history=await client.from('walmart_sale_alert_events').select('order_id,line_id,state,payload,updated_at').eq('owner_id',user.id).neq('state','baseline').order('updated_at',{ascending:false}).limit(10);if(history.error)throw Error('Could not load sale delivery history.');
 const health=await client.rpc('walmart_sale_schedule_status');let webhookDisplay='';if(settings.data?.webhook_encrypted){try{webhookDisplay=maskedDiscordWebhook(decrypt(settings.data.webhook_encrypted));}catch{webhookDisplay='Saved webhook · token hidden';}}
 const {webhook_encrypted:_,...safe}=settings.data||{};
 return NextResponse.json({settings:safe,configured:Boolean(settings.data),webhookDisplay,connected:await walmartPayoutOwnerMatches(user.id),health:health.error?null:health.data,history:history.data||[]});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Sale notification setup unavailable.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const input=await req.json();if(typeof input.enabled!=='boolean')return NextResponse.json({error:'Choose whether sale alerts are enabled.'},{status:400});
 const client=db();const previous=await client.from('walmart_sale_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(previous.error)throw Error('Run supabase/walmart_sale_alerts.sql in Supabase SQL Editor first.');
 let encrypted=previous.data?.webhook_encrypted;
 if(input.webhook!==undefined){if(typeof input.webhook!=='string')return NextResponse.json({error:'Enter a valid Discord webhook URL.'},{status:400});if(input.webhook.trim())encrypted=encrypt(discordWebhookUrl(input.webhook));}
 if(!encrypted)return NextResponse.json({error:'Paste a Discord webhook URL first.'},{status:400});
 if(input.enabled){if(!await walmartPayoutOwnerMatches(user.id))return NextResponse.json({error:'Connect your own Walmart account first.'},{status:409});const {origin,secret}=automationConfig();const schedule=await client.rpc('configure_walmart_sale_alerts',{p_origin:origin,p_secret:secret,p_bypass:process.env.VERCEL_AUTOMATION_BYPASS_SECRET||null});if(schedule.error)throw Error('Could not configure background checks. Run supabase/walmart_sale_alerts.sql and retry.');}
 const saved=await client.rpc('save_walmart_sale_alerts',{p_owner:user.id,p_webhook:encrypted,p_enabled:input.enabled});if(saved.error)throw Error('Could not save your sale alert settings.');
 if(input.enabled){const queued=await client.rpc('invoke_walmart_sale_alerts');if(queued.error)return NextResponse.json({saved:true,warning:'Settings saved, but the first background request could not be queued. Check the scheduler status.'});}
 return NextResponse.json({saved:true,message:input.enabled?'Saved. The background check is queued. Orders from before activation are recorded silently. New order lines created after activation alert automatically.':'Sale notifications disabled.'});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save sale alerts.'},{status:503});}}
