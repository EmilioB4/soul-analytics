import {NextRequest,NextResponse} from 'next/server';
import {importWhatnot} from '../../../../../lib/whatnot';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;const ownerId=process.env.WHATNOT_OWNER_ID;
 if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!ownerId||!/^[0-9a-f-]{36}$/i.test(ownerId))return NextResponse.json({error:'WHATNOT_OWNER_ID is missing or invalid'},{status:503});
 try{return NextResponse.json(await importWhatnot(ownerId));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Scheduled sync failed'},{status:502});}
}
