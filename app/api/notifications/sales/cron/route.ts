import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/tiktok';
import {decrypt} from '../../../../../lib/tiktok-orders';
import {sendDiscord} from '../../../../../lib/payout-alerts';
import {walmartSaleMessage,type WalmartSaleEvent} from '../../../../../lib/walmart-sale-message';
import {payoutSiteUrl} from '../../../../../lib/payout-brand';
import {POST as importOrders} from '../../../walmart/sync/route';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
 const client=db();const jobs=await client.from('walmart_sale_alert_settings').select('owner_id,enabled_at,last_success_at').eq('enabled',true).order('last_attempt_at',{ascending:true,nullsFirst:true}).limit(3);if(jobs.error)throw Error('Sale alert database unavailable.');
 const results=await Promise.all((jobs.data||[]).map(async job=>{
  const admitted=await client.from('profiles').select('user_id').eq('user_id',job.owner_id).maybeSingle();if(admitted.error)return {error:'Account admission unavailable.'};if(!admitted.data){await client.from('walmart_sale_alert_settings').update({enabled:false,last_error:'Account access removed.'}).eq('owner_id',job.owner_id);return {skipped:true};}
  const token=crypto.randomUUID(),started=Date.now();const claim=await client.rpc('claim_walmart_sale_check',{p_owner:job.owner_id,p_token:token});if(claim.error)return {error:'Could not claim sale check.'};if(!claim.data)return {skipped:true};
  let sent=0,processed=0;const errors:string[]=[];
  try{
   const deliver=async()=>{
   for(let i=0;i<3&&Date.now()-started<35000;i++){
    const settings=await client.from('walmart_sale_alert_settings').select('enabled,lock_token,webhook_encrypted').eq('owner_id',job.owner_id).maybeSingle();if(settings.error||!settings.data?.enabled||settings.data.lock_token!==token)break;
    const next=await client.rpc('claim_walmart_sale_delivery',{p_owner:job.owner_id,p_token:token});if(next.error)throw Error('Could not claim a sale notification.');const event=next.data?.[0];if(!event)break;processed++;
    let delivery;try{delivery=await sendDiscord(decrypt(settings.data.webhook_encrypted),walmartSaleMessage(event.payload as WalmartSaleEvent,payoutSiteUrl()));}catch{delivery={state:'uncertain' as const};}
    const retry=delivery.state==='retry'&&event.attempts<5;const state=delivery.state==='sent'?'sent':retry?'pending':'uncertain';
    const saved=await client.from('walmart_sale_alert_events').update({state,message_id:delivery.state==='sent'?delivery.messageId:null,retry_at:retry?new Date(Date.now()+('retrySeconds' in delivery?delivery.retrySeconds||300:300)*1000).toISOString():null,updated_at:new Date().toISOString()}).eq('owner_id',job.owner_id).eq('order_id',event.order_id).eq('line_id',event.line_id).eq('state','sending');if(saved.error)throw Error('Discord delivery confirmation could not be saved.');
    if(state==='sent')sent++;else{errors.push(retry?'Discord rate limit or service failure; retry queued.':'Delivery uncertain. Inspect the channel and webhook before resending.');break;}
   }
   };
   await deliver();
   if(processed===0){
   try{
    const since=job.last_success_at?Math.max(Date.parse(job.enabled_at),Date.parse(job.last_success_at)-86400000):Date.now()-86400000;
    const startDate=new Date(Math.max(since,Date.now()-89*86400000)).toISOString().slice(0,10);
    const request=new NextRequest('https://internal.invalid/sales',{method:'POST',headers:{authorization:`Bearer ${secret}`,'x-soul-sync-owner':job.owner_id,'x-soul-sales-lease':token,'content-type':'application/json'},body:JSON.stringify({startDate})});
    const response=await importOrders(request);const body=await response.json();if(!response.ok||body.diagnostics?.nextCursorPresent||body.diagnostics?.skippedOrders||body.diagnostics?.skippedLines||(body.orders>0&&body.lines===0))throw Error('Walmart order check failed or incomplete. Verify the connection and Orders permission.');
    const recorded=await client.rpc('record_walmart_sale_events',{p_owner:job.owner_id,p_token:token,p_rows:body.saleCandidates||[]});if(recorded.error)throw Error('Could not record new sales safely.');
   }catch(e){errors.push(e instanceof Error?e.message:'Sale source failed.');}
    await deliver();
   }
  }catch{errors.push('Sale notification processing failed. Check settings and delivery history.');}
  finally{await client.from('walmart_sale_alert_settings').update({last_error:errors.length?errors.join(' '):null,lock_token:null,locked_until:null}).eq('owner_id',job.owner_id).eq('lock_token',token);}
  return {sent,...(errors.length?{errors}:{})};
 }));return NextResponse.json({results});
 }catch{return NextResponse.json({error:'Automatic sale checks unavailable. Run the sale alert SQL setup.'},{status:503});}
}
