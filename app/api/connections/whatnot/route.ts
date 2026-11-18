import {NextRequest,NextResponse} from 'next/server';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {whatnotConnection,legacyWhatnotOwner,verifyWhatnotToken} from '../../../../lib/whatnot-connections';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {saved,setupRequired}=await whatnotConnection(user.id);return NextResponse.json({connected:saved?Boolean(saved.token_encrypted):legacyWhatnotOwner(user.id),legacy:!saved&&legacyWhatnotOwner(user.id),username:saved?.username||null,setupRequired});
}catch{return NextResponse.json({error:'Whatnot connection status unavailable.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const input=await req.json();if(typeof input.token!=='string'||input.token.trim().length<20||input.token.length>5000||/\s/.test(input.token.trim()))return NextResponse.json({error:'Paste a valid Whatnot API token without the Bearer prefix.'},{status:400});
 const previous=await whatnotConnection(user.id);if(previous.setupRequired)throw Error('Run supabase/whatnot_connections.sql in this website’s Supabase project first.');
 const seller=await verifyWhatnotToken(input.token.trim());
 if(previous.saved&&previous.saved.seller_id!==seller.id)return NextResponse.json({error:'This token belongs to a different Whatnot seller. Your existing stats were not changed.'},{status:409});
 if(!previous.saved&&legacyWhatnotOwner(user.id)){const legacy=await verifyWhatnotToken(process.env.WHATNOT_API_TOKEN!.trim());if(legacy.id!==seller.id)return NextResponse.json({error:'Use the same Whatnot seller as your current connection to keep historical stats separate.'},{status:409});}
 const result=await db().rpc('save_whatnot_connection',{p_owner:user.id,p_seller:seller.id,p_username:seller.username,p_token:encrypt(input.token.trim())});if(result.error)throw Error('Could not save your Whatnot connection.');
 return NextResponse.json({saved:true,username:seller.username});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not connect Whatnot.'},{status:503});}}
export async function DELETE(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const client=db(),previous=await whatnotConnection(user.id);if(previous.setupRequired)throw Error('Connection setup is required first.');
 if(!previous.saved&&legacyWhatnotOwner(user.id)){const seller=await verifyWhatnotToken(process.env.WHATNOT_API_TOKEN!.trim());const saved=await client.rpc('save_whatnot_connection',{p_owner:user.id,p_seller:seller.id,p_username:seller.username,p_token:null});if(saved.error)throw Error('Could not disconnect.');}
 else{const result=await client.from('whatnot_connections').update({token_encrypted:null,updated_at:new Date().toISOString()}).eq('owner_id',user.id);if(result.error)throw Error('Could not disconnect.');}
 await client.from('order_auto_syncs').update({enabled:false}).eq('owner_id',user.id).eq('platform','whatnot');
 return NextResponse.json({disconnected:true});
}catch{return NextResponse.json({error:'Could not disconnect Whatnot.'},{status:503});}}
