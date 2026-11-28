import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {summarizeEbay} from '../../../../lib/ebay-orders';
import {summarizeFinances,financePeriodCovered,type AccountingOrder,type EbayTransaction} from '../../../../lib/ebay-finances';
import {buildEbaySeries} from '../../../../lib/ebay-series';
import {newYorkMidnight} from '../../../../lib/walmart-period';
import {ebayDateRange,type EbayPeriod} from '../../../../lib/ebay-period';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const period=req.nextUrl.searchParams.get('period')||'30';if(!['today','yesterday','7','30','90','ytd'].includes(period))return NextResponse.json({error:'Invalid reporting period.'},{status:400});
 const range=ebayDateRange(period as EbayPeriod),client=db(),connection=await client.from('ebay_connections').select('account_id,last_sync_at').eq('owner_id',user.id).maybeSingle();if(connection.error)throw Error('Run supabase/ebay_setup.sql first.');if(!connection.data)return NextResponse.json({connected:false,orders:[],costs:[],transactions:[],range});
 const accountId=connection.data.account_id;
 const read=async(table:string,columns:string,keys:string[])=>{const out:any[]=[];for(let start=0;start<100000;start+=1000){let query=client.from(table).select(columns).eq('owner_id',user.id).eq('account_id',accountId);for(const key of keys)query=query.order(key);const result=await query.range(start,start+999);if(result.error)throw Error('Could not read eBay accounting. Run supabase/ebay_finances.sql after the existing eBay setup and deletion SQL.');out.push(...result.data||[]);if((result.data||[]).length<1000)return out;}throw Error('eBay dataset exceeds supported size.');};
 const [raw,costs,financial,snapshot]=await Promise.all([read('ebay_orders','order_id,data,shipping_cost,shipping_mode,packaging_cost',['order_id']),read('ebay_product_costs','sku,unit_cost',['sku']),read('ebay_transactions','data',['transaction_type','transaction_id']),client.from('ebay_finance_syncs').select('start_at,end_at,synced_at').eq('owner_id',user.id).eq('account_id',accountId).maybeSingle()]);
 if(snapshot.error)throw Error('Run supabase/ebay_finances.sql first.');
 const day=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
 const postedOrderIds=new Set(financial.map(r=>r.data as EbayTransaction).filter(t=>day(t.date)>=range.start&&day(t.date)<=range.end).map(t=>t.orderId));
 const orders=(raw as AccountingOrder[]).filter(r=>(day(r.data.createdAt)>=range.start&&day(r.data.createdAt)<=range.end)||postedOrderIds.has(r.order_id)).sort((a,b)=>b.data.createdAt.localeCompare(a.data.createdAt));
 const transactions=financial.map(r=>r.data as EbayTransaction),sync=snapshot.data;
 const nextDay=new Date(range.end+'T12:00:00Z');nextDay.setUTCDate(nextDay.getUTCDate()+1);
 const covered=financePeriodCovered(sync,newYorkMidnight(range.start),newYorkMidnight(nextDay.toISOString().slice(0,10)),newYorkMidnight(ebayDateRange('today').end));
 const accounting=summarizeFinances(transactions,raw as AccountingOrder[],costs,range.start,range.end,covered);
 return NextResponse.json({connected:true,orders,costs,range,lastSync:connection.data.last_sync_at,financeSync:sync,accounting,series:buildEbaySeries(transactions,raw as AccountingOrder[],costs,range.start,range.end,accounting.profit!==null),transactions:transactions.filter(t=>day(t.date)>=range.start&&day(t.date)<=range.end).sort((a,b)=>b.date.localeCompare(a.date)),totals:summarizeEbay(orders,costs)});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'eBay overview unavailable.'},{status:503});}}
