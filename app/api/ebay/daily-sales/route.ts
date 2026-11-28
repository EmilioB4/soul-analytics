import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {ebayAccessToken} from '../../../../lib/ebay-api';
import {ebayDateRange} from '../../../../lib/ebay-period';
import {newYorkMidnight} from '../../../../lib/walmart-period';
import {fetchSaleImage} from '../../../../lib/ebay-sale-images';
import type {EbayOrder} from '../../../../lib/ebay-orders';
export const runtime='nodejs';export const maxDuration=60;export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const date=req.nextUrl.searchParams.get('date')||ebayDateRange('today').end,pageText=req.nextUrl.searchParams.get('page')||'1';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!/^[1-9]\d{0,3}$/.test(pageText))return NextResponse.json({error:'Choose a valid day and page.'},{status:400});
 const page=Number(pageText),client=db(),connection=await client.from('ebay_connections').select('account_id').eq('owner_id',user.id).maybeSingle();if(connection.error)throw Error('Could not read your eBay connection.');
 if(!connection.data)return NextResponse.json({date,items:[],total:0,page,pages:0});
 const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 const result=await client.from('ebay_orders').select('order_id,data',{count:'exact'}).eq('owner_id',user.id).eq('account_id',connection.data.account_id).gte('created_at',newYorkMidnight(date)).lt('created_at',newYorkMidnight(next.toISOString().slice(0,10))).eq('data->>cancelled','false').in('data->>status',['PAID','PARTIALLY_REFUNDED','FULLY_REFUNDED']).order('created_at',{ascending:false}).order('order_id').range((page-1)*25,page*25-1);
 if(result.error||result.count==null)throw Error('Could not read daily eBay sales.');
 const orders=(result.data||[]) as {order_id:string;data:EbayOrder}[],ids=[...new Set(orders.flatMap(o=>o.data.lines.map(l=>l.listingId||(/^item:(\d{1,30})$/.exec(l.sku)?.[1]))).filter((id):id is string=>!!id&&/^\d{1,30}$/.test(id)))];
 const images=new Map<string,string|null>();let imageWarning='';
 if(ids.length){try{const access=await ebayAccessToken(user.id);if(access.accountId!==connection.data.account_id)throw Error('Connection changed.');const deadline=Date.now()+35000;let index=0;await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(index<ids.length){const id=ids[index++];if(Date.now()>=deadline){imageWarning='Some listing images are unavailable. Try refreshing.';break;}const image=await fetchSaleImage(id,access.token,Math.min(5000,deadline-Date.now()));images.set(id,image);if(!image)imageWarning='Some listing images are unavailable. Try refreshing.';}}));}catch{imageWarning='Listing images are unavailable. Sales data is still shown.';}}
 const items=orders.map(o=>({id:o.order_id,createdAt:o.data.createdAt,revenue:o.data.revenue,status:o.data.status,lines:o.data.lines.map(l=>{const id=l.listingId||/^item:(\d{1,30})$/.exec(l.sku)?.[1];return {id:l.id,sku:l.sku,title:l.title,quantity:l.quantity,image:id?images.get(id)||null:null,url:id?'https://www.ebay.com/itm/'+id:null};})}));
 if(orders.some(o=>o.data.lines.some(l=>!l.listingId&&!/^item:\d{1,30}$/.test(l.sku))))imageWarning='Sync eBay once to load listing images for older imported orders.';
 return NextResponse.json({date,items,total:result.count,page,pages:Math.ceil(result.count/25),imageWarning},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Daily sales unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
