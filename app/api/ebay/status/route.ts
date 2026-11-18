import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {ebayConfig} from '../../../../lib/ebay-config';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 let configured=true,setupMessage='';try{ebayConfig();}catch(e){configured=false;setupMessage='eBay connections are awaiting setup by this site’s administrator.';}
 const result=await db().from('ebay_connections').select('username,connected_at,last_sync_at,refresh_expires_at').eq('owner_id',user.id).maybeSingle();if(result.error)return NextResponse.json({connected:false,configured,setupRequired:true,setupMessage:'eBay storage is awaiting setup by this site’s administrator.'});
 return NextResponse.json({connected:Boolean(result.data),configured,setupRequired:false,setupMessage,connection:result.data});
}catch{return NextResponse.json({error:'Could not read your eBay connection.'},{status:503});}}
export async function DELETE(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const result=await db().rpc('disconnect_ebay',{p_owner:user.id});if(result.error)throw Error();return NextResponse.json({disconnected:true});
}catch{return NextResponse.json({error:'Could not disconnect eBay.'},{status:503});}}
