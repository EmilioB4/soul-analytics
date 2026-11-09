import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {walmartAccessToken,walmartReport} from '../../../../lib/walmart-api';
import {reportDate} from '../../../../lib/walmart-finance';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {error}=await db().from('walmart_settlement_reports').select('report_date').eq('owner_id',user.id).limit(1);
  if(error)throw Error('Settlement database setup is required: run supabase/walmart_settlements.sql in Supabase SQL Editor.');
  const token=await walmartAccessToken();
  const data=await walmartReport('/v3/report/reconreport/availableReconFiles?reportVersion=v1',token);
  if(!Array.isArray(data.availableApReportDates))throw Error('Unrecognized Walmart report dates response. No settlement data changed.');
  const cutoff=new Date(Date.now()-120*86400000).toISOString().slice(0,10);
  const dates:string[]=data.availableApReportDates;
  if(dates.some(date=>!reportDate(date)))throw Error('Walmart returned an unrecognized report date format.');
  return NextResponse.json({dates:[...new Set(dates)].filter(d=>reportDate(d)!>=cutoff).sort((a,b)=>reportDate(a)!.localeCompare(reportDate(b)!)).reverse()});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not list settlement reports'},{status:502});}
}
