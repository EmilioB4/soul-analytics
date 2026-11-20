import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {ebayAccessToken} from '../../../../lib/ebay-api';
import {fetchActiveListings} from '../../../../lib/ebay-listings';
export const runtime='nodejs';export const maxDuration=30;export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const value=req.nextUrl.searchParams.get('page')||'1';if(!/^[1-9]\d{0,3}$/.test(value))return NextResponse.json({error:'Invalid listing page.'},{status:400});
 const access=await ebayAccessToken(user.id),result=await fetchActiveListings(access.token,Number(value));
 return NextResponse.json({...result,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load your eBay listings.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
