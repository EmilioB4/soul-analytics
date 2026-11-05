import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {configured} from '../../../../lib/whatnot';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{if(!await owner(req.headers.get('authorization')))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json({configured:configured()});}catch{return NextResponse.json({error:'Unable to check connection'},{status:503});}}
