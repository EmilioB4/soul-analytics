import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../../../lib/tiktok';
import {syncWfsInventory} from '../../../../../../lib/walmart-wfs-sync';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){
 try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await syncWfsInventory(user.id));}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'WFS inventory sync failed; previous data preserved.'},{status:502});}
}
