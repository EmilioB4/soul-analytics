import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
import {walmartAccessToken,walmartReport} from '../../../../../lib/walmart-api';
import {parseWalmartTransaction,reportDate,WalmartTransaction} from '../../../../../lib/walmart-finance';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const input=await req.json();const date=input.reportDate;
  if(typeof date!=='string'||!reportDate(date))return NextResponse.json({error:'Choose an available Walmart report date.'},{status:400});
  const started=Date.now();const token=await walmartAccessToken();
  const available=await walmartReport('/v3/report/reconreport/availableReconFiles?reportVersion=v1',token);
  if(!Array.isArray(available.availableApReportDates)||!available.availableApReportDates.includes(date))return NextResponse.json({error:'This settlement report is not available for the connected Walmart account.'},{status:400});
  const rows:WalmartTransaction[]=[];let offset=0;const seen=new Set<number>();
  while(true){
   if(Date.now()-started>35000)throw Error('Settlement report exceeded the sync time budget. Previous data was preserved; retry this report later.');
   const url=new URL('https://marketplace.walmartapis.com/v3/report/reconreport/reconFileJson');
   url.searchParams.set('reportDate',date);url.searchParams.set('offset',String(offset));url.searchParams.set('noOfRecords','1000');
   const data=await walmartReport(url.pathname+url.search,token);
   if(!Array.isArray(data.reportData))throw Error('Unrecognized settlement report response. Previous data preserved.');
   for(const raw of data.reportData){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid settlement row. Previous data preserved.');
    rows.push(parseWalmartTransaction(raw,date,rows.length));
   }
   if(rows.length>50000)throw Error('Settlement report exceeds 50,000 rows. Previous data preserved.');
   const next=Number(data.nextOffset??0);
   if(!Number.isFinite(next)||!Number.isInteger(next)||next< -1)throw Error('Invalid settlement pagination offset. Previous data preserved.');
   if(next===0||next===-1)break;
   if(!data.reportData.length)throw Error('Empty report page with a continuation offset. Previous data preserved.');
   if(next===offset||seen.has(next))throw Error('Repeated settlement pagination offset. Previous data preserved.');
   seen.add(offset);offset=next;
  }
  const {error}=await db().rpc('replace_walmart_settlement_report',{p_owner:user.id,p_report_date:date,p_rows:rows});
  if(error)throw Error(`Settlement database save failed: ${error.message}. Run supabase/walmart_settlements.sql if setup is missing.`);
  return NextResponse.json({reportDate:date,transactions:rows.length,fees:rows.filter(r=>r.kind==='fee').length,unknown:rows.filter(r=>r.kind==='unknown').length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Settlement sync failed; previous report data preserved.'},{status:502});}
}
