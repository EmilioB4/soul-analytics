import {db} from './tiktok';
import {walmartAccessToken,walmartReport} from './walmart-api';
import {downloadWalmartCatalog} from './walmart-catalog';
import {downloadWfsInventory} from './walmart-wfs';
export async function syncWfsInventory(ownerId:string){
 const started=Date.now();const database=db();
 const {data:state,error:setupError}=await database.from('walmart_wfs_syncs').select('last_sync_at').eq('owner_id',ownerId).maybeSingle();
 if(setupError)throw Error('Run supabase/walmart_wfs_inventory.sql in Supabase SQL Editor to enable WFS tracking.');
 // Browser polling, manual sync and cron share one lock and a short cooldown.
 const {data:lease,error:leaseError}=await database.rpc('claim_walmart_wfs_sync',{p_owner:ownerId});
 if(leaseError)throw Error(`Could not start WFS sync: ${leaseError.message}`);
 if(!lease)return {skipped:true,message:'WFS inventory was checked recently or another sync is running.',lastSync:state?.last_sync_at||null};
 try{
  const token=await walmartAccessToken();const rows=await downloadWfsInventory(path=>walmartReport(path,token,'WFS inventory'),Math.max(0,30000-(Date.now()-started)));
  try{if(Date.now()-started>35000)throw Error('Listing-price lookup deferred to keep stock sync within its time budget.');const catalog=await downloadWalmartCatalog(path=>walmartReport(path,token,'listing prices'),Math.max(1,35000-(Date.now()-started)));const now=new Date().toISOString();for(const item of rows){const listing=catalog.get(item.sku);item.listed_price=listing?.price??null;item.price_currency=listing?.currency??null;item.price_seen_at=listing?.price!=null?now:null;item.price_error=listing?.price!=null?null:'No listing price returned for this SKU.';}}catch(e){for(const item of rows){item.listed_price=null;item.price_currency=null;item.price_seen_at=null;item.price_error=e instanceof Error?e.message:'Listing-price lookup failed';}}
  const {error}=await database.rpc('replace_walmart_wfs_inventory',{p_owner:ownerId,p_items:rows,p_lease:lease});
  if(error)throw Error(`WFS inventory save failed: ${error.message}`);
  return {items:rows.length,lastSync:new Date().toISOString()};
 }catch(e){const message=e instanceof Error?e.message:'WFS sync failed';await database.from('walmart_wfs_syncs').update({last_error:message.slice(0,500),lease_token:null,lease_until:null}).eq('owner_id',ownerId).eq('lease_token',lease);throw Error(message);}
}
