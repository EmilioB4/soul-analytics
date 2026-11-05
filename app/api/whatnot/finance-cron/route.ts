import {NextRequest,NextResponse} from 'next/server';
import {syncFinancialReports} from '../../../../lib/whatnot-finance';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const id=process.env.WHATNOT_OWNER_ID;
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Set WHATNOT_OWNER_ID in Vercel'},{status:503});
 try{return NextResponse.json(await syncFinancialReports(id));}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Financial sync failed'},{status:502});}
}
