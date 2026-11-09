import {payoutSiteUrl} from './payout-brand';
import {db} from './tiktok';
import {decrypt} from './tiktok-orders';
import {collectPayouts} from './payout-sources';
import {discordWebhookUrl,payoutMessage,type PayoutEvent} from './payout-events';
export async function sendDiscord(webhook:string,message:unknown){
 const url=new URL(discordWebhookUrl(webhook));url.searchParams.set('wait','true');
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(response.status===429){let seconds=60;try{const body=await response.json();seconds=Math.min(86400,Math.max(1,Number(body.retry_after)||60));}catch{}return {state:'retry' as const,retrySeconds:seconds};}
  if(!response.ok)return {state:response.status>=500?'retry' as const:'uncertain' as const,retrySeconds:300};
  const data=await response.json().catch(()=>null);if(!data?.id)return {state:'uncertain' as const};
  return {state:'sent' as const,messageId:String(data.id)};
 }catch{return {state:'uncertain' as const};}
}
export async function checkPayoutAlerts(ownerId:string){
 const client=db(),token=crypto.randomUUID();
 const {data:claimed,error:claimError}=await client.rpc('claim_payout_alert_check',{p_owner:ownerId,p_token:token});if(claimError)throw Error('Install supabase/payout_notifications.sql first.');if(!claimed)return {skipped:true,notice:'Alerts are disabled or another check is running.'};
 let checked=0,sent=0,baselined=0;const errors:string[]=[],started=Date.now();
 try{
  const {data:settings,error}=await client.from('payout_alert_settings').select('*').eq('owner_id',ownerId).single();if(error||!settings)throw Error('Could not load alert settings.');
  let webhook:string;try{webhook=discordWebhookUrl(decrypt(settings.webhook_encrypted));}catch{throw Error('Discord webhook could not be decrypted. Re-save it in Integrations.');}
  // A killed invocation may have reached Discord before it could record success.
  const stale=await client.from('payout_alert_events').update({state:'uncertain',updated_at:new Date().toISOString()}).eq('owner_id',ownerId).eq('state','sending');if(stale.error)throw Error('Could not inspect delivery history.');
  const platforms=(['tiktok','walmart'] as const).filter(p=>settings[`${p}_enabled`]);
  const results=await Promise.allSettled(platforms.map(async platform=>({platform,events:await collectPayouts(ownerId,platform)})));
  for(let i=0;i<results.length;i++){
   const result=results[i],platform=platforms[i];
   if(result.status==='rejected'){errors.push(`${platform}: payout source unavailable; check connection and Finance/Reports permissions.`);continue;}
   checked++;const events=result.value.events;
   const {data:source,error:sourceError}=await client.from('payout_alert_sources').select('initialized_at').eq('owner_id',ownerId).eq('platform',platform).maybeSingle();if(sourceError)throw Error('Could not load payout baseline.');
   const row=(event:PayoutEvent,state:string)=>({owner_id:ownerId,platform,event_id:event.id,stage:event.stage,state,amount:event.amount,event_date:event.date});
   if(!source){
    for(let n=0;n<events.length;n+=200){const saved=await client.from('payout_alert_events').upsert(events.slice(n,n+200).map(e=>row(e,'baseline')),{onConflict:'owner_id,platform,event_id,stage',ignoreDuplicates:true});if(saved.error)throw Error('Could not save initial payout baseline.');}
    const initialized=await client.from('payout_alert_sources').insert({owner_id:ownerId,platform});if(initialized.error)throw Error('Could not initialize payout baseline.');baselined++;continue;
   }
   const history=new Map<string,{state:string;retry_after:string|null;attempts:number}>(),ids=[...new Set(events.map(e=>e.id))];
   for(let n=0;n<ids.length;n+=200){const existing=await client.from('payout_alert_events').select('event_id,stage,state,retry_after,attempts').eq('owner_id',ownerId).eq('platform',platform).in('event_id',ids.slice(n,n+200)).limit(1000);if(existing.error)throw Error('Could not inspect notification history.');for(const item of existing.data||[])history.set(item.event_id+'|'+item.stage,item);}
   for(const event of events){
    if(Date.now()-started>45000||sent>=5)break;
    const key={owner_id:ownerId,platform,event_id:event.id,stage:event.stage};
    const prior=history.get(event.id+'|'+event.stage);
    if(prior&&(prior.state!=='retry'||(prior.retry_after&&Date.parse(prior.retry_after)>Date.now())))continue;
    const {data:current,error:currentError}=await client.from('payout_alert_settings').select('enabled,webhook_encrypted,lock_token').eq('owner_id',ownerId).single();if(currentError||!current?.enabled||current.lock_token!==token||current.webhook_encrypted!==settings.webhook_encrypted)throw Error('Alert configuration changed; check stopped.');
    const pending={...row(event,'sending'),attempts:(prior?.attempts||0)+1,updated_at:new Date().toISOString()};
    const save=prior?await client.from('payout_alert_events').update(pending).match(key):await client.from('payout_alert_events').insert(pending);if(save.error)throw Error('Could not claim notification; nothing sent.');
    const delivery=await sendDiscord(webhook,payoutMessage(event,{siteUrl:payoutSiteUrl()}));
    const saved=await client.from('payout_alert_events').update({state:delivery.state,message_id:delivery.messageId||null,retry_after:delivery.state==='retry'?new Date(Date.now()+(delivery.retrySeconds||60)*1000).toISOString():null,updated_at:new Date().toISOString()}).match(key);if(saved.error)throw Error('Delivery confirmation could not be saved; check history before retrying.');
    if(delivery.state==='sent')sent++;else {errors.push(delivery.state==='retry'?'Discord temporarily unavailable; delivery will retry.':'Discord delivery uncertain or webhook rejected. Review the channel and webhook; this event will not automatically resend.');break;}
   }
  }
  const finish=await client.from('payout_alert_settings').update({last_checked_at:new Date().toISOString(),last_error:errors.join(' ').slice(0,1000)||null}).eq('owner_id',ownerId).eq('lock_token',token);if(finish.error)throw Error('Could not save check status.');
  return {checked,sent,baselined,errors,notice:baselined?'Existing payouts recorded as the starting baseline. Future newly observed statuses will alert.':'Payout check completed.'};
 }catch(e){await client.from('payout_alert_settings').update({last_checked_at:new Date().toISOString(),last_error:'Payout check incomplete. Review provider connection, webhook and database setup.'}).eq('owner_id',ownerId).eq('lock_token',token);throw e;}finally{await client.from('payout_alert_settings').update({lock_token:null,locked_until:null}).eq('owner_id',ownerId).eq('lock_token',token);}
}
