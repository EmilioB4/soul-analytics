import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {summarizeEbay,type EbayOrder} from '../../../../lib/ebay-orders';
import {walmartDateRange,type WalmartPeriod} from '../../../../lib/walmart-period';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const period=req.nextUrl.searchParams.get('period')||'30';if(!['today','yesterday','7','30','90','ytd'].includes(period))return NextResponse.json({error:'Invalid reporting period.'},{status:400});
 const range=walmartDateRange(period as WalmartPeriod),client=db(),connection=await client.from('ebay_connections').select('account_id,last_sync_at').eq('owner_id',user.id).maybeSingle();if(connection.error)throw Error('Run supabase/ebay_setup.sql first.');if(!connection.data)return NextResponse.json({connected:false,orders:[],costs:[],range});
 const accountId=connection.data.account_id;
 const read=async(table:string,keys:string[])=>{const out:unknown[]=[];for(let start=0;start<100000;start+=1000){let query=client.from(table).select(table==='ebay_orders'?'order_id,data,shipping_cost':'sku,unit_cost').eq('owner_id',user.id).eq('account_id',accountId);for(const key of keys)query=query.order(key);const result=await query.range(start,start+999);if(result.error)throw Error('Could not read your eBay data.');out.push(...result.data||[]);if((result.data||[]).length<1000)return out;}throw Error('eBay dataset exceeds supported size.');};
 const [raw,costs]=await Promise.all([read('ebay_orders',['order_id']),read('ebay_product_costs',['sku'])]);
 const orders=(raw as {order_id:string;data:EbayOrder;shipping_cost:number|null}[]).filter(r=>{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.data.createdAt));return day>=range.start&&day<=range.end;}).sort((a,b)=>b.data.createdAt.localeCompare(a.data.createdAt));
 return NextResponse.json({connected:true,orders,costs,range,lastSync:connection.data.last_sync_at,totals:summarizeEbay(orders,costs as {sku:string;unit_cost:number}[])});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'eBay overview unavailable.'},{status:503});}}
