import type {NextRequest} from 'next/server';
import {owner,db} from './tiktok';
import {walmartPayoutOwnerMatches} from './payout-ownership';
export async function syncRequestOwner(req:NextRequest,platform:'tiktok'|'walmart'){
 const dailyLease=req.headers.get('x-soul-daily-lease');
 const salesLease=req.headers.get('x-soul-sales-lease');
 const id=req.headers.get('x-soul-sync-owner'),lease=dailyLease||salesLease||req.headers.get('x-soul-sync-lease');
 if(!id&&!lease)return owner(req.headers.get('authorization'));
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`||!id||!lease||!/^[-a-f0-9]{36}$/i.test(id)||!/^[-a-f0-9]{36}$/i.test(lease))return null;
 if(dailyLease){
  const day=req.headers.get('x-soul-daily-day');if(platform!=='walmart'||!day||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const client=db(),event=await client.from('walmart_daily_summary_events').select('state,lock_token,locked_until').eq('owner_id',id).eq('report_day',day).maybeSingle();
  const prefs=await client.from('walmart_daily_webhooks').select('enabled').eq('owner_id',id).maybeSingle();
  if(event.error||prefs.error||!prefs.data?.enabled||event.data?.state!=='building'||event.data.lock_token!==lease||!event.data.locked_until||Date.parse(event.data.locked_until)<=Date.now()||!await walmartPayoutOwnerMatches(id))return null;
  return {id};
 }
 if(salesLease&&platform!=='walmart')return null;
 const query=db().from(salesLease?'walmart_sale_alert_settings':'order_auto_syncs').select('enabled,lock_token,locked_until').eq('owner_id',id);
 const {data,error}=await (salesLease?query:query.eq('platform',platform)).maybeSingle();
 if(error||!data?.enabled||data.lock_token!==lease||!data.locked_until||Date.parse(data.locked_until)<=Date.now())return null;
 if(platform==='walmart'&&!await walmartPayoutOwnerMatches(id))return null;
 return {id};
}
