import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../../lib/tiktok';
import {syncWfsInventory} from '../../../../../../lib/walmart-wfs-sync';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const {data,error}=await db().from('walmart_wfs_syncs').select('owner_id').eq('enabled',true).order('last_attempt_at',{ascending:true,nullsFirst:true}).limit(1);if(error)throw Error('WFS database setup is required.');
 const results=[];const started=Date.now();for(const row of data||[]){if(Date.now()-started>40000)break;try{results.push({owner:row.owner_id,...await syncWfsInventory(row.owner_id)});}catch(e){results.push({owner:row.owner_id,error:e instanceof Error?e.message:'Sync failed'});}}
 return NextResponse.json({results,remaining:Math.max(0,(data||[]).length-results.length)},{status:results.some(r=>'error' in r)?502:200});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Scheduled WFS sync failed'},{status:502});}
}
