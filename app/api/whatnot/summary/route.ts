import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {configured} from '../../../../../lib/whatnot';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db();const orders=await client.from('whatnot_orders').select('external_id,status,created_at,synced_at',{count:'exact'}).eq('owner_id',user.id).order('created_at',{ascending:false,nullsFirst:false}).limit(12);
 if(orders.error)return NextResponse.json({error:'Whatnot tables not installed. Run supabase/whatnot.sql.'},{status:503});
 const shows=await client.from('whatnot_shows').select('external_id,title,status,created_at',{count:'exact'}).eq('owner_id',user.id).order('created_at',{ascending:false,nullsFirst:false}).limit(8);
 if(shows.error)return NextResponse.json({error:'Whatnot show table unavailable.'},{status:503});
 return NextResponse.json({configured:configured(),orders:orders.count??0,shows:shows.count??0,recent:orders.data||[],recentShows:shows.data||[]});
 }catch{return NextResponse.json({error:'Unable to read Whatnot data'},{status:503});}}
