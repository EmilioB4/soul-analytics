export type WalmartTransaction={report_date:string;row_index:number;posted_date:string;order_id:string|null;line_id:string|null;sku:string|null;fee_type:string;kind:'fee'|'refund'|'sale'|'tax'|'transfer'|'unknown';amount:number;currency:string;raw:Record<string,unknown>};
export type WalmartSale={order_id:string;line_id:string;order_date:string;sku:string;fulfillment:string};
export type WalmartFee={order_id:string|null;sku:string|null;fee_date:string;fee_type:string;amount:number;line_id?:string|null};
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function reportDate(value:unknown):string|null{
 const s=String(value??'').trim();
 let iso=s;
 const us=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/);
 if(us)iso=`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
 if(/^\d{8}$/.test(s)){if(/^(19|20)\d{6}$/.test(s))iso=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;else iso=`${s.slice(4)}-${s.slice(0,2)}-${s.slice(2,4)}`;}
 if(!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(iso))return null;
 const d=new Date(iso);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso.slice(0,10)?d.toISOString().slice(0,10):null;
}
export function parseWalmartTransaction(raw:Record<string,unknown>,date:string,index:number):WalmartTransaction{
 const fields=new Map(Object.entries(raw).map(([k,v])=>[normalize(k),v]));
 const get=(...keys:string[])=>String(keys.map(k=>fields.get(normalize(k))).find(v=>v!==undefined&&v!==null&&v!=='')??'').trim();
 const type=get('Transaction Type'),amountType=get('Amount Type'),description=get('Transaction Description');
 const combined=`${type} ${amountType} ${description}`;
 const currency=get('Currency')||'USD';
 if(currency!=='USD')throw Error(`Unsupported settlement currency ${currency} at row ${index+1}.`);
 let kind:WalmartTransaction['kind']='unknown';
 if(/payment.?summary|deposit|payout|reserve|total payable|fund transfer/i.test(type+' '+amountType))kind='transfer';
 // Classify sale/refund amounts before descriptions: WFS can appear in a
 // product transaction description without turning its price into a fee.
 else if(/^(product price|shipping(?: price| charge)?)$/i.test(amountType))kind=/refund|return/i.test(type)?'refund':/sale/i.test(type)?'sale':'unknown';
 else if(/tax on product|product tax|tax on shipping|shipping tax|^tax$/i.test(amountType))kind='tax';
 else if(/commission|referral|fulfill|prep|storage|inbound|label|transport|disposal|removal|return processing|fee|surcharge|chargeback/i.test(combined))kind='fee';
 const value=get('Amount');
 const amount=Number(value.replace(/[$,\s]/g,'').replace(/^\((.*)\)$/,'-$1'));
 if((!value||!Number.isFinite(amount))&&kind!=='transfer')throw Error(`Missing or invalid settlement Amount at row ${index+1}; no changes saved.`);
 const postedValue=get('Transaction Posted Timestamp','Transaction Posted Date');
 const posted=reportDate(postedValue||date);
 if(!posted)throw Error(`Invalid settlement date at row ${index+1}.`);
 return {report_date:date,row_index:index,posted_date:posted,order_id:get('Purchase Order #','Purchase Order Id')||null,line_id:get('Purchase Order line #')||null,sku:get('Partner Item Id','SKU')||null,fee_type:amountType||description||type||'Unclassified',kind,amount:kind==='transfer'&&!value?0:amount,currency,raw};
}
// Settlement amounts are signed from the seller's perspective. Debits become
// positive expenses; fee reimbursements become negative expenses.
export function settlementFees(rows:WalmartTransaction[]):WalmartFee[]{
 return rows.filter(r=>r.kind==='fee').map(r=>({order_id:r.order_id,line_id:r.line_id,sku:r.sku,fee_date:r.posted_date,fee_type:r.fee_type,amount:-r.amount}));
}
export function allocateWalmartFees(sales:WalmartSale[],fees:WalmartFee[],cutoff='',filter='All'){
 const selected=sales.filter(s=>(!cutoff||s.order_date>=cutoff)&&(filter==='All'||s.fulfillment===filter));
 const orderLines=new Map<string,WalmartSale[]>();
 for(const sale of sales){const lines=orderLines.get(sale.order_id)||[];lines.push(sale);orderLines.set(sale.order_id,lines);}
 const byGroup=new Map<string,number>();const byOrder=new Map<string,number>();
 let total=0,unallocated=0,excludedShared=0;
 const included:WalmartFee[]=[];
 for(const fee of fees){
  const matches=fee.order_id?(orderLines.get(fee.order_id)||[]).filter(s=>(!fee.line_id||s.line_id===fee.line_id)&&(!fee.sku||s.sku===fee.sku)):[];
  const eligible=matches.filter(s=>(!cutoff||s.order_date>=cutoff)&&(filter==='All'||s.fulfillment===filter));
  // Match order fees by the sale date, even if settlement was posted later.
  // Unmatched account charges use their posting date and stay unallocated.
  if(matches.length&&!eligible.length)continue;
  if(!matches.length){
   if(cutoff&&fee.fee_date<cutoff)continue;
   if(filter!=='All'){excludedShared+=Number(fee.amount);continue;}
  }
  total+=Number(fee.amount);included.push(fee);
  if(eligible.length&&fee.order_id)byOrder.set(fee.order_id,(byOrder.get(fee.order_id)||0)+Number(fee.amount));
  const keys=new Set(eligible.map(s=>s.sku+'|'+s.fulfillment));
  if(keys.size===1){const key=[...keys][0];byGroup.set(key,(byGroup.get(key)||0)+Number(fee.amount));}
  else unallocated+=Number(fee.amount);
 }
 return {selected,byGroup,byOrder,total,unallocated,excludedShared,included};
}
