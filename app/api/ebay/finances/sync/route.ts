import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {ebayAccessToken,ebayGet} from '../../../../../lib/ebay-api';
import {fetchFinanceWindow} from '../../../../../lib/ebay-finances';
import {walmartDateRange,newYorkMidnight,type WalmartPeriod} from '../../../../../lib/walmart-period';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db(),lease=crypto.randomUUID();let accountId='';
 try{
  const input=await req.json().catch(()=>({})),period=input.period||'30';if(!['today','yesterday','7','30','90','ytd'].includes(period))return NextResponse.json({error:'Invalid period.'},{status:400});
  const range=walmartDateRange(period as WalmartPeriod),start=newYorkMidnight(range.start),end=new Date().toISOString();
  const access=await ebayAccessToken(user.id);accountId=access.accountId;
  const claim=await client.rpc('claim_ebay_sync',{p_owner:user.id,p_account:accountId,p_token:lease});if(claim.error||!claim.data)throw Error('An eBay sync is already running. Try again shortly.');
  const deadline=Date.now()+40000;
  const rows=await fetchFinanceWindow(path=>{if(Date.now()>=deadline)throw Error('Financial import timed out. Previous data was preserved.');return ebayGet(path,access.token,Math.max(1,Math.min(12000,deadline-Date.now())));},start,end);
  const saved=await client.rpc('save_ebay_finances',{p_owner:user.id,p_account:accountId,p_token:lease,p_start:start,p_end:end,p_rows:rows});if(saved.error)throw Error('Could not save finances. Run supabase/ebay_finances.sql in this site’s database.');
  return NextResponse.json({imported:rows.length,message:'Orders and financial activity refreshed. Review any missing costs before using profit.'});
 }catch(e){return NextResponse.json({error:(e instanceof Error?e.message:'eBay finance import failed.')+' If eBay denied finance access, reconnect eBay and approve finance permissions. EU/UK accounts may require additional eBay digital-signature setup.'},{status:503});}
 finally{if(accountId)await client.from('ebay_connections').update({sync_lock:null,sync_locked_until:null}).eq('owner_id',user.id).eq('account_id',accountId).eq('sync_lock',lease);}
}
