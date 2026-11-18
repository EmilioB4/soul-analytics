import {db} from './tiktok';
import {walmartAccessToken,walmartReport} from './walmart-api';
import {downloadWalmartReturns,type WalmartReturn} from './walmart-returns';
import {calculateDailySummary,type DailyInput} from './walmart-daily-summary';
export async function loadDailySummary(ownerId:string,day:string,deadline=Date.now()+30000){
 const client=db(),remaining=()=>Math.max(1,Math.min(8000,deadline-Date.now()));
 const read=async(table:string,keys:string[])=>{
  const rows:unknown[]=[];
  for(let start=0;start<100000;start+=1000){
   if(Date.now()>=deadline)throw Error('Summary data time budget exceeded.');
   let query=client.from(table).select('*').eq('owner_id',ownerId);
   for(const key of keys)query=query.order(key);
   const result=await query.range(start,start+999).abortSignal(AbortSignal.timeout(remaining()));
   if(result.error)throw Error('Summary source unavailable.');
   rows.push(...result.data||[]);if((result.data||[]).length<1000)return rows;
  }throw Error('Summary dataset exceeds supported size.');
 };
 const results=await Promise.allSettled([
  read('walmart_sales',['order_id','line_id']),read('walmart_fees',['transaction_id']),
  read('walmart_product_costs',['sku']),read('walmart_settlement_transactions',['report_date','row_index']),
  read('walmart_return_recoveries',['return_id','return_line_id']),read('walmart_fee_assumptions',['sku'])
 ]);
 if(results[0].status!=='fulfilled')throw Error('Sales data unavailable; no summary sent.');
 const rows=(i:number)=>results[i].status==='fulfilled'?(results[i] as PromiseFulfilledResult<unknown[]>).value:[];
 let returns:WalmartReturn[]=[],returnsReady=false;
 try{if(Date.now()>=deadline)throw Error('Budget exceeded');const token=await walmartAccessToken(ownerId,remaining());returns=await downloadWalmartReturns(path=>walmartReport(path,token,'customer returns',remaining()),day,Math.max(1,deadline-Date.now()));returnsReady=true;}catch{}
 const input={day,sales:rows(0),fees:rows(1),costs:rows(2),settlements:rows(3),recoveries:rows(4),profiles:rows(5),returns,returnsReady,financeReady:results[1].status==='fulfilled'&&results[3].status==='fulfilled'&&results[5].status==='fulfilled',costsReady:results[2].status==='fulfilled',recoveriesReady:results[4].status==='fulfilled'} as DailyInput;
 return calculateDailySummary(input);
}
