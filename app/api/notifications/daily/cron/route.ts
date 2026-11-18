import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/tiktok';
import {decrypt} from '../../../../../lib/tiktok-orders';
import {dailySummaryDay,dailySummaryMessage} from '../../../../../lib/walmart-daily-summary';
import {loadDailySummary} from '../../../../../lib/walmart-daily-data';
import {payoutSiteUrl} from '../../../../../lib/payout-brand';
import {sendDiscord} from '../../../../../lib/payout-alerts';
import {POST as importOrders} from '../../../walmart/sync/route';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const client=db(),day=dailySummaryDay();
  const owners=await client.from('walmart_daily_webhooks').select('owner_id').eq('enabled',true).order('last_attempt_at',{nullsFirst:true}).limit(3);if(owners.error)throw Error('Daily summary schema unavailable.');
  const results=await Promise.all((owners.data||[]).map(async({owner_id:id})=>{
   const started=Date.now(),token=crypto.randomUUID();
   const claim=await client.rpc('claim_walmart_daily_summary',{p_owner:id,p_day:day,p_token:token});
   if(claim.error)return {state:'error',error:'Summary claim unavailable.'};if(!claim.data)return {state:'skipped'};
   try{
    const synced=await importOrders(new NextRequest('https://internal.invalid/api/walmart/sync',{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET,'Content-Type':'application/json','x-soul-sync-owner':id,'x-soul-daily-lease':token,'x-soul-daily-day':day},body:JSON.stringify({startDate:day,endDate:day})}));
    const sync=await synced.json();if(!synced.ok||sync.diagnostics?.nextCursorPresent||sync.diagnostics?.skippedOrders||sync.diagnostics?.skippedLines)throw Error('Order refresh incomplete; summary will retry.');
    const summary=await loadDailySummary(id,day,started+43000);
    const prefs=await client.from('walmart_daily_webhooks').select('enabled,use_sale_webhook,webhook_encrypted').eq('owner_id',id).single();if(prefs.error||!prefs.data?.enabled)throw Error('Daily summary disabled or unavailable.');
    let encrypted=prefs.data.webhook_encrypted;
    if(prefs.data.use_sale_webhook){const sale=await client.from('walmart_sale_alert_settings').select('webhook_encrypted').eq('owner_id',id).single();if(sale.error)throw Error('Sale webhook unavailable.');encrypted=sale.data.webhook_encrypted;}
    if(!encrypted)throw Error('Summary webhook unavailable.');
    const webhook=decrypt(encrypted);
    const begin=await client.rpc('begin_walmart_daily_delivery',{p_owner:id,p_day:day,p_token:token,p_payload:summary});if(begin.error||!begin.data)throw Error('Delivery lease expired or account disabled.');
    const delivery=await sendDiscord(webhook,dailySummaryMessage(summary,payoutSiteUrl()));
    const lastError=delivery.state==='sent'?null:delivery.state==='retry'?'Discord temporarily unavailable; retry scheduled.':'Delivery uncertain; inspect Discord. No automatic resend.';
    const saved=await client.from('walmart_daily_summary_events').update({state:delivery.state,message_id:delivery.messageId||null,retry_at:delivery.state==='retry'?new Date(Date.now()+(delivery.retrySeconds||300)*1000).toISOString():null,last_error:lastError,locked_until:null,updated_at:new Date().toISOString()}).eq('owner_id',id).eq('report_day',day).eq('lock_token',token).eq('state','sending');if(saved.error)throw Error('Delivery status could not be saved.');
    await client.from('walmart_daily_webhooks').update({last_error:lastError}).eq('owner_id',id);return {day,state:delivery.state};
   }catch{
    const error='Summary incomplete. Check your Walmart connection, data permissions and saved webhook. Background checks retry unless delivery is uncertain.';
    // Only retry before sending; interrupted sends become uncertain, avoiding duplicates.
    await client.from('walmart_daily_summary_events').update({state:'retry',retry_at:new Date(Date.now()+300000).toISOString(),locked_until:null,last_error:error,updated_at:new Date().toISOString()}).eq('owner_id',id).eq('report_day',day).eq('lock_token',token).eq('state','building');
    await client.from('walmart_daily_webhooks').update({last_error:error}).eq('owner_id',id);return {day,state:'error',error};
   }
  }));
  return NextResponse.json({results});
 }catch{return NextResponse.json({error:'Daily summary scheduler unavailable.'},{status:503});}
}
