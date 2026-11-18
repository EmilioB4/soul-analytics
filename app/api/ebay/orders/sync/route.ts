import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {ebayAccessToken,ebayGet} from '../../../../../lib/ebay-api';
import {parseEbayOrder,type EbayOrder} from '../../../../../lib/ebay-orders';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db(),lease=crypto.randomUUID();let accountId='';
 try{
  const access=await ebayAccessToken(user.id);accountId=access.accountId;
  const claim=await client.rpc('claim_ebay_sync',{p_owner:user.id,p_account:accountId,p_token:lease});if(claim.error||!claim.data)throw Error('An eBay import is already running. Try again shortly.');
  const deadline=Date.now()+40000,start=new Date(Date.now()-30*86400000).toISOString(),end=new Date().toISOString(),rows:EbayOrder[]=[];
  let offset=0,total:number|undefined;
  do{
   if(Date.now()>=deadline)throw Error('eBay import time budget exceeded. No partial batch was saved.');
   const query=new URLSearchParams({filter:'creationdate:['+start+'..'+end+']',limit:'100',offset:String(offset)});
   const data=await ebayGet('/sell/fulfillment/v1/order?'+query,access.token,Math.max(1,Math.min(12000,deadline-Date.now())));
   if(data.total===0&&data.orders===undefined)data.orders=[];
   if(!Array.isArray(data.orders)||!Number.isSafeInteger(data.total)||data.total<0||(total!==undefined&&total!==data.total))throw Error('eBay pagination changed or returned an incomplete response. Retry.');
   total=data.total;if(total!>2000)throw Error('More than 2,000 orders in the last 30 days. This initial importer needs a larger-account backfill.');
   rows.push(...data.orders.map(parseEbayOrder));offset+=data.orders.length;
   if(offset<total!&&data.orders.length===0)throw Error('Incomplete eBay order pagination.');
  }while(offset<total!);
  if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.length!==total)throw Error('Duplicate or incomplete eBay order pages.');
  const saved=await client.rpc('save_ebay_orders',{p_owner:user.id,p_account:accountId,p_token:lease,p_rows:rows});if(saved.error)throw Error('Could not save your eBay import safely.');
  return NextResponse.json({imported:rows.length,message:'Imported the last 30 days of eBay orders. Reported order fees included; account charges and refunds still need reconciliation.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'eBay import failed.'},{status:503});}
 finally{if(accountId)await client.from('ebay_connections').update({sync_lock:null,sync_locked_until:null}).eq('owner_id',user.id).eq('account_id',accountId).eq('sync_lock',lease);}
}
