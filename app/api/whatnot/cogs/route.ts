import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json() as Record<string,unknown>;
 const id=typeof body.livestream_id==='string'?body.livestream_id.trim():'';
 const amount=body.total_cogs;
 if(!id||id==='unassigned'||id.length>256||!(/^[a-zA-Z0-9_:\-]+$/.test(id)))return NextResponse.json({error:'Choose a valid stream ID'},{status:400});
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100000000||Math.round(amount*100)!==amount*100)return NextResponse.json({error:'Enter a valid nonnegative COGS amount with at most two decimals'},{status:400});
 const title=typeof body.livestream_title==='string'?body.livestream_title.slice(0,180):null;
 const {error}=await db().from('whatnot_stream_cogs').upsert({owner_id:user.id,livestream_id:id,livestream_title:title,total_cogs:amount,updated_at:new Date().toISOString()},{onConflict:'owner_id,livestream_id'});
 if(error)throw Error('Unable to save stream COGS. Install whatnot_financials.sql first.');
 return NextResponse.json({saved:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save COGS'},{status:503});}}
