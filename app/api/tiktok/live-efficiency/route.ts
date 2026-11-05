import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {accessToken,tikTokCall} from '../../../../lib/tiktok-orders';
export const runtime='nodejs';
function obj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function date(v:unknown){const n=Number(v);if(Number.isFinite(n)&&n>1e9){const d=new Date(n>1e12?n:n*1000);return Number.isNaN(d.valueOf())?null:d.toISOString();}if(typeof v==='string'){const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.toISOString();}return null;}
function amount(v:unknown):number|null{const x=obj(v);const n=Number(x.amount??v);return Number.isFinite(n)&&v!=null?n:null;}
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:conn}=await db().from('tiktok_connections').select('owner_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,refresh_expires_at').eq('owner_id',user.id).maybeSingle();
  if(!conn)return NextResponse.json({error:'Connect TikTok Shop first.'},{status:409});
  const token=await accessToken(conn);
  const shopResponse=await tikTokCall('/authorization/202309/shops',token);
  const shops=shopResponse?.shops;
  if(!Array.isArray(shops)||shops.length!==1||!shops[0]?.cipher)return NextResponse.json({error:'Exactly one TikTok shop must be authorized.'},{status:409});
  const end=new Date();end.setUTCDate(end.getUTCDate()+1);
  const start=new Date();start.setUTCDate(start.getUTCDate()-30);
  const result=await tikTokCall('/analytics/202509/shop_lives/performance',token,undefined,{
   shop_cipher:String(shops[0].cipher),start_date_ge:start.toISOString().slice(0,10),end_date_lt:end.toISOString().slice(0,10),
   page_size:'100',currency:'USD',account_type:'ALL',sort_field:'gmv',sort_order:'DESC'
  });
  const list=Array.isArray(result?.live_stream_sessions)?result.live_stream_sessions:[];
  const sessions=list.map((raw:unknown)=>{
   const x=obj(raw),performance=obj(x.sales_performance),startAt=date(x.start_time),endAt=date(x.end_time);
   const minutes=startAt&&endAt?Math.max(0,(Date.parse(endAt)-Date.parse(startAt))/60000):null;
   const gmv=amount(performance.gmv);
   return {id:String(x.id||''),title:String(x.title||'TikTok LIVE'),startAt,endAt,minutes,gmv,
    orders:Number.isFinite(Number(performance.sku_orders))?Number(performance.sku_orders):null,
    items:Number.isFinite(Number(performance.items_sold))?Number(performance.items_sold):null,
    salesPerHour:minutes!==null&&minutes>0&&gmv!==null?Math.round(gmv*60/minutes*100)/100:null};
  }).filter((s:{id:string})=>s.id);
  return NextResponse.json({sessions,coverage:'Latest 30 days; up to 100 LIVE sessions.',nextPageAvailable:!!result?.next_page_token,
   note:'LIVE GMV is a session-attributed TikTok metric and is not the same as settled net earnings. Profit per hour is unavailable until session-specific COGS and fees are reconciled.'});
 }catch(e){const message=e instanceof Error?e.message:'LIVE analytics unavailable';
  return NextResponse.json({error:/scope|permission|not authorized|access denied/i.test(message)?'TikTok Shop Analytics permission is required. Reauthorize with that scope.':message.slice(0,230)},{status:502});}
}
