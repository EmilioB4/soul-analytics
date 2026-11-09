import {db} from './tiktok';
import {walmartAccessToken,walmartReport} from './walmart-api';
import {downloadWfsInventory} from './walmart-wfs';
export async function syncWfsInventory(ownerId:string){
 const database=db();
 const {data:state,error:setupError}=await database.from('walmart_wfs_syncs').select('last_sync_at').eq('owner_id',ownerId).maybeSingle();
 if(setupError)throw Error('Run supabase/walmart_wfs_inventory.sql in Supabase SQL Editor to enable WFS tracking.');
 // Browser polling, manual sync and cron share one lock and a short cooldown.
 const {data:lease,error:leaseError}=await database.rpc('claim_walmart_wfs_sync',{p_owner:ownerId});
 if(leaseError)throw Error(`Could not start WFS sync: ${leaseError.message}`);
 if(!lease)return {skipped:true,message:'WFS inventory was checked recently or another sync is running.',lastSync:state?.last_sync_at||null};
 try{
  const token=await walmartAccessToken();const rows=await downloadWfsInventory(path=>walmartReport(path,token,'WFS inventory'));
  const {error}=await database.rpc('replace_walmart_wfs_inventory',{p_owner:ownerId,p_items:rows,p_lease:lease});
  if(error)throw Error(`WFS inventory save failed: ${error.message}`);
  return {items:rows.length,lastSync:new Date().toISOString()};
 }catch(e){const message=e instanceof Error?e.message:'WFS sync failed';await database.from('walmart_wfs_syncs').update({last_error:message.slice(0,500),lease_token:null,lease_until:null}).eq('owner_id',ownerId).eq('lease_token',lease);throw Error(message);}
}
