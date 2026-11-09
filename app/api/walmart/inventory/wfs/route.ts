import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const database=db(),items:unknown[]=[];
 for(let offset=0;offset<=50000;offset+=1000){const {data,error}=await database.from('walmart_wfs_inventory').select('sku,data,last_seen_at,stale').eq('owner_id',user.id).order('sku').range(offset,offset+999);if(error)return NextResponse.json({error:'WFS setup is required. Run supabase/walmart_wfs_inventory.sql in Supabase SQL Editor.',setupRequired:true},{status:503});items.push(...(data||[]));if(items.length>50000)throw Error('WFS inventory exceeds the 50,000-SKU display limit.');if((data||[]).length<1000)break;}
 const [sync,changes]=await Promise.all([database.from('walmart_wfs_syncs').select('last_sync_at,last_attempt_at,last_error,enabled').eq('owner_id',user.id).maybeSingle(),database.from('walmart_wfs_changes').select('id,sku,changed_at,before_data,after_data').eq('owner_id',user.id).order('id',{ascending:false}).limit(30)]);
 if(sync.error||changes.error)throw Error('Could not load WFS sync status or stock activity.');
 return NextResponse.json({items,state:sync.data,changes:changes.data||[]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'WFS load failed'},{status:502});}
}
