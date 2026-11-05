import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {callWhatnot} from '../../../../lib/whatnot';
export const runtime='nodejs';
function obj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=req.nextUrl.searchParams.get('show_id')||'';
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id))return NextResponse.json({error:'Invalid show ID'},{status:400});
  const data=obj(await callWhatnot(`/analytics/shows/${encodeURIComponent(id)}`));
  const a=obj(data.data||data),minutes=typeof a.stream_minutes==='number'&&a.stream_minutes>0?a.stream_minutes:null;
  const count=typeof a.orders_count==='number'?a.orders_count:null;
  return NextResponse.json({minutes,startAt:typeof a.start_time==='string'?a.start_time:null,
   orders:count,views:typeof a.total_views==='number'?a.total_views:null,
   warning:minutes===null?'Whatnot has not returned a valid broadcast duration for this show.':null});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message.slice(0,230):'Could not load show analytics'},{status:502});}
}
