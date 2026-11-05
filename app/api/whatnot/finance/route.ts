import {NextRequest,NextResponse} from 'next/server';
import {owner} from '../../../../lib/tiktok';
import {financialSummary} from '../../../../lib/whatnot-finance-summary';
import {syncFinancialReports} from '../../../../lib/whatnot-finance';
export const runtime='nodejs';export const maxDuration=60;
export async function GET(req:NextRequest){try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await financialSummary(user.id));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Financial summary unavailable'},{status:503});}}
export async function POST(req:NextRequest){try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await syncFinancialReports(user.id));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Financial sync failed'},{status:502});}}
