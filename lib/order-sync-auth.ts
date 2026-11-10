import type {NextRequest} from 'next/server';
import {owner,db} from './tiktok';
import {walmartPayoutOwnerMatches} from './payout-ownership';
export async function syncRequestOwner(req:NextRequest,platform:'tiktok'|'walmart'){
 const id=req.headers.get('x-soul-sync-owner'),lease=req.headers.get('x-soul-sync-lease');
 if(!id&&!lease)return owner(req.headers.get('authorization'));
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`||!id||!lease||!/^[-a-f0-9]{36}$/i.test(id)||!/^[-a-f0-9]{36}$/i.test(lease))return null;
 const {data,error}=await db().from('order_auto_syncs').select('enabled,lock_token,locked_until').eq('owner_id',id).eq('platform',platform).maybeSingle();
 if(error||!data?.enabled||data.lock_token!==lease||!data.locked_until||Date.parse(data.locked_until)<=Date.now())return null;
 if(platform==='walmart'&&!await walmartPayoutOwnerMatches(id))return null;
 return {id};
}
