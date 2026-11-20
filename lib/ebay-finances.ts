import type {EbayOrder} from './ebay-orders';
export type EbayTransaction={id:string;type:string;date:string;orderId:string|null;signedCents:number;feeCents:number|null;feeType:string|null;fees:{type:string;cents:number}[]};
export type AccountingOrder={order_id:string;data:EbayOrder;shipping_cost:number|null;shipping_mode?:string|null;packaging_cost?:number|null};
const object=(v:unknown):Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export function cents(value:unknown){
 const v=object(value);if(v.currency!=='USD'||typeof v.value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(v.value))throw Error('Finance import requires nonnegative USD amounts with at most two decimals.');
 const [whole,fraction='']=v.value.split('.'),n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>1e12)throw Error('Invalid finance amount.');return n;
}
export function parseEbayTransaction(raw:unknown):EbayTransaction{
 const row=object(raw);if(typeof row.transactionId!=='string'||!row.transactionId||row.transactionId.length>512||typeof row.transactionType!=='string'||!row.transactionType||row.transactionType.length>100||typeof row.transactionDate!=='string'||!Number.isFinite(Date.parse(row.transactionDate))||!['CREDIT','DEBIT'].includes(row.bookingEntry))throw Error('Incomplete eBay financial transaction.');
 const sign=row.bookingEntry==='CREDIT'?1:-1,fees:{type:string;cents:number}[]=[];
 if(row.orderLineItems!=null&&!Array.isArray(row.orderLineItems))throw Error('Invalid eBay fee breakdown.');
 for(const line of row.orderLineItems||[]){if(line.marketplaceFees!=null&&!Array.isArray(line.marketplaceFees))throw Error('Invalid eBay fees.');for(const fee of line.marketplaceFees||[])fees.push({type:typeof fee.feeType==='string'?fee.feeType:'OTHER',cents:cents(fee.amount)});}
 return {id:row.transactionId,type:row.transactionType,date:new Date(row.transactionDate).toISOString(),orderId:typeof row.orderId==='string'&&row.orderId?row.orderId:null,signedCents:sign*cents(row.amount),feeCents:row.totalFeeAmount==null?null:cents(row.totalFeeAmount),feeType:typeof row.feeType==='string'?row.feeType:null,fees};
}
export async function fetchFinanceWindow(get:(path:string)=>Promise<any>,start:string,end:string){
 const rows:EbayTransaction[]=[];let offset=0,total:number|undefined;
 do{
  const q=new URLSearchParams({filter:`transactionDate:[${start}..${end}]`,limit:'200',offset:String(offset)});
  const page=await get('https://apiz.ebay.com/sell/finances/v1/transaction?'+q);
  if((Array.isArray(page.warnings)&&page.warnings.length)||(Array.isArray(page.errors)&&page.errors.length))throw Error('eBay returned a financial warning; previous data was preserved.');
  if(!Array.isArray(page.transactions)||!Number.isSafeInteger(page.total)||page.total<0||page.total>4000||(total!==undefined&&page.total!==total))throw Error('eBay financial pages changed or exceed 4,000 transactions. No partial financial batch saved.');
  total=page.total;rows.push(...page.transactions.map(parseEbayTransaction));offset+=page.transactions.length;
  if(offset<total!&&!page.transactions.length)throw Error('Incomplete eBay financial pages.');
 }while(offset<total!);
 if(rows.length!==total||new Set(rows.map(r=>r.type+':'+r.id)).size!==rows.length||rows.some(r=>r.date<start||r.date>end))throw Error('Duplicate, out-of-window or incomplete financial transactions.');
 return rows;
}
export function summarizeFinances(transactions:EbayTransaction[],orders:AccountingOrder[],costs:{sku:string;unit_cost:number}[],start:string,end:string,covered:boolean){
 const day=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
 const selected=transactions.filter(t=>day(t.date)>=start&&day(t.date)<=end),issues:string[]=[],byOrder=new Map(orders.map(o=>[o.order_id,o])),saleIds=new Set<string>(),feeGroups=new Map<string,number>();
 const costMap=new Map(costs.map(c=>[c.sku,Math.round(Number(c.unit_cost)*100)]));
 const money=(n:number)=>n/100;let net=0,sales=0,units=0,cogs=0,externalShipping=0,packaging=0,labelNet=0,nonSaleNet=0,refundNet=0,fees=0,missingCosts=0,missingShipping=0,missingPackaging=0,unmatched=0,unknown=0,conflicts=0;
 if(!covered)issues.push('Sync finances for the full selected period.');
 const supported=new Set(['SALE','REFUND','CREDIT','DISPUTE','NON_SALE_CHARGE','SHIPPING_LABEL']);
 for(const t of selected){
  if(t.type==='TRANSFER')continue; // Funding movement: never a second operating expense.
  net+=t.signedCents;
  if(!supported.has(t.type)){unknown++;continue;}
  if(t.type==='SHIPPING_LABEL')labelNet-=t.signedCents;
  if(t.type==='NON_SALE_CHARGE'){nonSaleNet-=t.signedCents;feeGroups.set(t.feeType||'OTHER_ACCOUNT_CHARGE',(feeGroups.get(t.feeType||'OTHER_ACCOUNT_CHARGE')||0)-t.signedCents);}
  if(t.type==='REFUND'||t.type==='DISPUTE'){refundNet-=t.signedCents;if(!t.orderId||!byOrder.has(t.orderId))unmatched++;}
  if(['SALE','REFUND'].includes(t.type)){
   const sign=t.type==='SALE'?1:-1;if(t.feeCents!==null)fees+=sign*t.feeCents;
   if(t.feeCents===null)issues.push('A sale or refund is missing its financial fee total.');
   for(const f of t.fees)feeGroups.set(f.type,(feeGroups.get(f.type)||0)+sign*f.cents);
   if(t.feeCents!==null&&t.fees.reduce((s,f)=>s+f.cents,0)!==t.feeCents)feeGroups.set('UNITEMIZED_SELLING_FEES',(feeGroups.get('UNITEMIZED_SELLING_FEES')||0)+sign*(t.feeCents-t.fees.reduce((s,f)=>s+f.cents,0)));
  }
  if(t.type==='SALE'){
   if(!t.orderId||!byOrder.has(t.orderId)){unmatched++;continue;}
   if(saleIds.has(t.orderId)){issues.push('Multiple sale transactions reference one order; review split payments.');continue;}
   saleIds.add(t.orderId);const o=byOrder.get(t.orderId)!;sales+=Math.round(o.data.revenue*100);
   // eBay's net amount is authoritative; order totals are a reconciliation check, not another deduction.
   if(t.signedCents<0||t.feeCents===null||Math.round(o.data.revenue*100)!==t.signedCents+(t.feeCents||0))issues.push('A sale does not reconcile to its order revenue and financial fees.');
   for(const line of o.data.lines){units+=line.quantity;const c=costMap.get(line.sku);if(c===undefined)missingCosts++;else cogs+=c*line.quantity;}
   const labels=transactions.filter(x=>x.type==='SHIPPING_LABEL'&&x.orderId===t.orderId);
   if(o.shipping_mode==='ebay'){if(!labels.length)missingShipping++;}
   else if(o.shipping_cost!=null){if(labels.length)conflicts++;else externalShipping+=Math.round(Number(o.shipping_cost)*100);}
   else missingShipping++;
   if(o.packaging_cost==null)missingPackaging++;else packaging+=Math.round(Number(o.packaging_cost)*100);
  }
 }
 const postedIds=new Set(transactions.filter(t=>t.type==='SALE').map(t=>t.orderId));
 const awaiting=orders.filter(o=>!o.data.cancelled&&['PAID','PARTIALLY_REFUNDED','FULLY_REFUNDED'].includes(o.data.status)&&day(o.data.createdAt)>=start&&day(o.data.createdAt)<=end&&!postedIds.has(o.order_id)).length;
 if(awaiting)issues.push(`${awaiting} paid orders await financial sale transactions.`);
 if(missingCosts)issues.push(`${missingCosts} item lines need COGS.`);
 if(missingShipping)issues.push(`${missingShipping} orders need a shipping source and cost.`);
 if(missingPackaging)issues.push(`${missingPackaging} orders need packaging cost (confirm 0 if none).`);
 if(unmatched)issues.push(`${unmatched} sale/refund transactions need their original order imported.`);
 if(unknown)issues.push(`${unknown} financial transactions need classification.`);
 if(conflicts)issues.push(`${conflicts} orders have both manual postage and eBay labels; select eBay labels to avoid duplicates.`);
 const unique=[...new Set(issues)],profit=unique.length?null:money(net-cogs-externalShipping-packaging);
 return {sales:money(sales),units,orders:saleIds.size,netProceeds:money(net),sellingFees:money(fees),accountCharges:money(nonSaleNet),ebayLabels:money(labelNet),refundsAndDisputes:money(refundNet),cogs:money(cogs),externalShipping:money(externalShipping),packaging:money(packaging),profit,margin:profit!==null&&sales>0?Math.round(profit/money(sales)*10000)/100:null,issues:unique,feeGroups:[...feeGroups].map(([type,value])=>({type,amount:money(value)})),transactionCount:selected.length};
}
