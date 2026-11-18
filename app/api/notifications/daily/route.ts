import {NextRequest,NextResponse} from 'next/server';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {decrypt} from '../../../../lib/tiktok-orders';
import {discordWebhookUrl,maskedDiscordWebhook} from '../../../../lib/payout-events';
import {walmartPayoutOwnerMatches} from '../../../../lib/payout-ownership';
import {automationConfig} from '../../../../lib/automation';
export const runtime='nodejs';
const setup='Run supabase/walmart_daily_summary.sql in the Supabase project used by this website.';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db(),prefs=await client.from('walmart_daily_webhooks').select('*').eq('owner_id',user.id).maybeSingle();if(prefs.error)throw Error(setup);
 const sale=await client.from('walmart_sale_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();
 const history=await client.from('walmart_daily_summary_events').select('report_day,state,payload,last_error,updated_at').eq('owner_id',user.id).order('report_day',{ascending:false}).limit(10);if(history.error)throw Error('Could not read your summary history.');
 const health=await client.rpc('walmart_daily_schedule_status');
 const encrypted=prefs.data?.use_sale_webhook?sale.data?.webhook_encrypted:prefs.data?.webhook_encrypted;
 let webhookDisplay='';if(encrypted)try{webhookDisplay=maskedDiscordWebhook(decrypt(encrypted));}catch{webhookDisplay='Saved webhook · token hidden';}
 const {webhook_encrypted:_,...settings}=prefs.data||{};
 return NextResponse.json({settings,configured:Boolean(encrypted),hasSaleWebhook:Boolean(sale.data?.webhook_encrypted),webhookDisplay,history:history.data||[],health:health.error?null:health.data});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Summary settings unavailable.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const input=await req.json();if(typeof input.enabled!=='boolean'||typeof input.useSaleWebhook!=='boolean')return NextResponse.json({error:'Choose your summary settings.'},{status:400});
 const client=db(),previous=await client.from('walmart_daily_webhooks').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(previous.error)throw Error(setup);
 let encrypted=previous.data?.webhook_encrypted||null;
 if(input.webhook!==undefined){if(typeof input.webhook!=='string')return NextResponse.json({error:'Enter a Discord webhook URL.'},{status:400});if(input.webhook.trim())encrypted=encrypt(discordWebhookUrl(input.webhook));}
 if(input.enabled){
  if(!await walmartPayoutOwnerMatches(user.id))return NextResponse.json({error:'Connect your own Walmart account in Integrations first.'},{status:409});
  if(input.useSaleWebhook){const sale=await client.from('walmart_sale_alert_settings').select('webhook_encrypted').eq('owner_id',user.id).maybeSingle();if(sale.error||!sale.data?.webhook_encrypted)return NextResponse.json({error:'Save a sale-alert webhook below, or choose a separate summary webhook.'},{status:400});}
  else if(!encrypted)return NextResponse.json({error:'Paste a Discord webhook URL first.'},{status:400});
  const {origin,secret}=automationConfig(),scheduled=await client.rpc('configure_walmart_daily_summary',{p_origin:origin,p_secret:secret,p_bypass:process.env.VERCEL_AUTOMATION_BYPASS_SECRET||null});if(scheduled.error)throw Error(setup);
 }
 const saved=await client.rpc('save_walmart_daily_webhook',{p_owner:user.id,p_enabled:input.enabled,p_reuse:input.useSaleWebhook,p_webhook:encrypted});if(saved.error)throw Error('Could not save your daily summary.');
 let warning='';if(input.enabled){const queued=await client.rpc('invoke_walmart_daily_summary');if(queued.error)warning='First request could not be queued. Check background schedule status.';}
 return NextResponse.json({saved:true,warning,message:input.enabled?'Saved. Daily summaries start at 11:59 PM New York time, beginning today.':'Daily summaries disabled.'});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save daily summaries.'},{status:503});}}
