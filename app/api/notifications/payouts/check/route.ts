import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../../lib/tiktok';
import {checkPayoutAlerts} from '../../../../../lib/payout-alerts';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await checkPayoutAlerts(user.id));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Payout check failed.'},{status:503});}}
