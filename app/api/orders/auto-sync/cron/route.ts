import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/tiktok';
import {POST as walmartSync} from '../../../walmart/sync/route';
import {POST as tiktokSync} from '../../../tiktok/orders/sync/route';
import {importWhatnot} from '../../../../../lib/whatnot';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const client=db();const {data,error}=await client.from('order_auto_syncs').select('owner_id,platform').eq('enabled',true).order('last_attempt_at',{ascending:true,nullsFirst:true}).limit(3);if(error)throw Error('Install supabase/order_auto_sync.sql.');
  const results=await Promise.all((data||[]).map(async job=>{
   const lease=crypto.randomUUID();const claimed=await client.rpc('claim_order_auto_sync',{p_owner:job.owner_id,p_platform:job.platform,p_token:lease});if(claimed.error)return {platform:job.platform,error:'Could not claim sync.'};if(!claimed.data)return {platform:job.platform,skipped:true};
   try{
    let count=0;
    if(job.platform==='whatnot'){
     if(process.env.WHATNOT_OWNER_ID!==job.owner_id)throw Error('Whatnot owner configuration does not match.');
     const result=await importWhatnot(job.owner_id);if(result.incomplete)throw Error('Whatnot pagination incomplete; manual backfill required.');count=result.ordersProcessed;
    }else{
     const startDate=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
     const request=new NextRequest('https://internal.invalid/order-sync',{method:'POST',headers:{authorization:`Bearer ${secret}`,'x-soul-sync-owner':job.owner_id,'x-soul-sync-lease':lease,'content-type':'application/json'},body:JSON.stringify({startDate})});
     const response=await (job.platform==='walmart'?walmartSync(request):tiktokSync(request));const body=await response.json();
     if(!response.ok)throw Error(`${job.platform} order sync failed; check its connection and manual sync diagnostics.`);
     if(body.complete===false||body.diagnostics?.nextCursorPresent||body.diagnostics?.skippedOrders||body.diagnostics?.skippedLines||(body.orders>0&&body.lines===0))throw Error('Import was incomplete; manual backfill or diagnostics required.');
     count=Number(body.lines??body.imported??0);
    }
    const saved=await client.from('order_auto_syncs').update({last_success_at:new Date().toISOString(),last_error:null,last_count:count}).eq('owner_id',job.owner_id).eq('platform',job.platform).eq('lock_token',lease);if(saved.error)throw Error('Could not save sync status.');return {platform:job.platform,count};
   }catch(e){const message=e instanceof Error?e.message:'Order sync failed.';await client.from('order_auto_syncs').update({last_error:message}).eq('owner_id',job.owner_id).eq('platform',job.platform).eq('lock_token',lease);return {platform:job.platform,error:message};}
   finally{await client.from('order_auto_syncs').update({lock_token:null,locked_until:null}).eq('owner_id',job.owner_id).eq('platform',job.platform).eq('lock_token',lease);}
  }));return NextResponse.json({results});
 }catch{return NextResponse.json({error:'Automatic order sync setup is missing or unavailable.'},{status:503});}
}
