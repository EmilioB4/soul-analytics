import {db} from './tiktok';
type Ledger={ledger_transaction_id:string;order_id:string|null;livestream_id:string|null;livestream_title:string|null;transaction_type:string;amount:number|string;sale_price:number|string|null;commission_fee:number|string|null;processing_fee:number|string|null;commission_tax:number|string|null;processing_tax:number|string|null;seller_shipping:number|string|null;completed_at:string|null};
const val=(v:unknown)=>Number(v||0);
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export async function financialSummary(ownerId:string){
 const client=db();const ledger:Ledger[]=[];
 for(let offset=0;offset<20000;offset+=500){
  const {data,error}=await client.from('whatnot_ledger').select('ledger_transaction_id,order_id,livestream_id,livestream_title,transaction_type,amount,sale_price,commission_fee,processing_fee,commission_tax,processing_tax,seller_shipping,completed_at').eq('owner_id',ownerId).order('ledger_transaction_id').range(offset,offset+499);
  if(error)throw Error('Financial tables missing. Run whatnot_financials.sql.');
  ledger.push(...(data||[]) as Ledger[]);if(!data||data.length<500)break;
 }
 const {data:costs,error:cErr}=await client.from('whatnot_stream_cogs').select('livestream_id,livestream_title,total_cogs').eq('owner_id',ownerId);
 if(cErr)throw Error('Stream cost table missing. Run whatnot_financials.sql.');
 const orderShow=new Map<string,string>();
 for(const tx of ledger)if(tx.transaction_type==='ORDER_EARNINGS'&&tx.order_id&&tx.livestream_id)orderShow.set(tx.order_id,tx.livestream_id);
 type Metrics={id:string;title:string;gross:number;earnings:number;commission:number;processing:number;feeTaxes:number;shipping:number;refunds:number;otherAdjustments:number;orders:Set<string>;entries:number;cogs:number|null;firstSaleAt:string|null};
 const map=new Map<string,Metrics>();
 const ensure=(id:string,title:string)=>{let m=map.get(id);if(!m){m={id,title,gross:0,earnings:0,commission:0,processing:0,feeTaxes:0,shipping:0,refunds:0,otherAdjustments:0,orders:new Set(),entries:0,cogs:null,firstSaleAt:null};map.set(id,m);}else if(title&&m.title===id)m.title=title;return m;};
 for(const tx of ledger){
  const id=tx.livestream_id||(tx.order_id?orderShow.get(tx.order_id):null)||'unassigned';
  const m=ensure(id,tx.livestream_title|| (id==='unassigned'?'Unassigned / marketplace':id));
  m.earnings+=val(tx.amount);m.entries++;
  if(tx.transaction_type==='ORDER_EARNINGS'){
   if(tx.completed_at && (!m.firstSaleAt || tx.completed_at<m.firstSaleAt))m.firstSaleAt=tx.completed_at;m.gross+=val(tx.sale_price);m.commission+=Math.abs(val(tx.commission_fee));m.processing+=Math.abs(val(tx.processing_fee));m.feeTaxes+=Math.abs(val(tx.commission_tax))+Math.abs(val(tx.processing_tax));m.shipping+=Math.abs(val(tx.seller_shipping));if(tx.order_id)m.orders.add(tx.order_id);
  }else if(/REFUND/.test(tx.transaction_type))m.refunds+=val(tx.amount);
  else if(/SHIPPING|CARRIER/.test(tx.transaction_type))m.shipping+=Math.abs(Math.min(0,val(tx.amount)));
  else m.otherAdjustments+=val(tx.amount);
 }
 for(const c of costs||[]){const m=ensure(c.livestream_id,c.livestream_title||c.livestream_id);m.cogs=val(c.total_cogs);}
 const streams=Array.from(map.values()).map(m=>({id:m.id,title:m.title,firstSaleAt:m.firstSaleAt,gross:round(m.gross),earnings:round(m.earnings),commission:round(m.commission),processing:round(m.processing),feeTaxes:round(m.feeTaxes),shipping:round(m.shipping),refunds:round(m.refunds),otherAdjustments:round(m.otherAdjustments),orders:m.orders.size,entries:m.entries,cogs:m.cogs,profit:m.cogs===null?null:round(m.earnings-m.cogs)})).sort((a,b)=>b.gross-a.gross);
 const {data:runs,error:rErr}=await client.from('whatnot_report_runs').select('status,created_at,imported_at,start_at,end_at').eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(20);
 if(rErr)throw Error('Unable to read financial report status.');
 return {streams,ledgerEntries:ledger.length,reportRuns:runs||[],totalEarnings:round(streams.reduce((s,m)=>s+m.earnings,0)),totalGross:round(streams.reduce((s,m)=>s+m.gross,0)),unassigned:streams.find(m=>m.id==='unassigned')||null,warning:'Net earnings are signed financial ledger amounts, before your COGS. Some shipping and adjustments can remain unassigned. Settlements post after orders; this is not a payout statement.'};
}
