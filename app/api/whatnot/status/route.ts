import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {configured} from '../../../../lib/whatnot';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({configured:await configured(user.id)});}catch{return NextResponse.json({error:'Unable to check connection'},{status:503});}}
