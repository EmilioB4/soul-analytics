import {allocateWalmartFees,settlementFees,type WalmartSale,type WalmartFee,type WalmartTransaction} from './walmart-finance';
import {feeReserves,type FeeProfile} from './walmart-fee-reserves';
import {walmartRefundAccounting} from './walmart-refund-accounting';
import type {WalmartReturn,ReturnRecovery} from './walmart-returns';
import {walmartToday} from './walmart-period';
export const summaryTimezone='America/New_York';
export function dailySummaryDay(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:summaryTimezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const day=parts.year+'-'+parts.month+'-'+parts.day;
 return parts.hour==='23'&&parts.minute==='59'?day:new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
}
export type DailySummary={day:string;revenue:number;profit:number|null;units:number;orders:number;refunds:number;estimatedFees:number;partial:boolean;reason:string};
export type DailyInput={day:string;sales:(WalmartSale&{quantity:number;revenue:number})[];fees:WalmartFee[];settlements:WalmartTransaction[];costs:{sku:string;unit_cogs:number}[];profiles:FeeProfile[];returns:WalmartReturn[];recoveries:ReturnRecovery[];financeReady:boolean;returnsReady:boolean;costsReady:boolean;recoveriesReady:boolean};
export function calculateDailySummary(input:DailyInput):DailySummary{
 const {day}=input,round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
 const sales=input.sales.map(s=>({...s,quantity:Number(s.quantity),revenue:Number(s.revenue),order_date:/^\d{4}-\d{2}-\d{2}$/.test(s.order_date)?s.order_date:walmartToday(new Date(s.order_date))}));
 if(sales.some(s=>!Number.isFinite(s.quantity)||!Number.isFinite(s.revenue)))throw Error('Invalid sales amounts; summary not sent.');
 const selected=sales.filter(s=>s.order_date===day),allFees=[...input.fees,...settlementFees(input.settlements)];
 const actual=allocateWalmartFees(sales,allFees,day,'All',day),refunds=walmartRefundAccounting(input.returns,input.settlements,sales,input.recoveries,day,day);
 const shipping=input.settlements.filter(t=>t.kind==='sale'&&/shipping/i.test(t.fee_type)&&t.posted_date===day).reduce((n,t)=>n+Number(t.amount),0);
 const revenue=round(selected.reduce((n,s)=>n+s.revenue,0)-refunds.total+shipping),costs=new Map(input.costs.map(c=>[c.sku,Number(c.unit_cogs)]));
 const missing=selected.some(s=>!costs.has(s.sku)||!Number.isFinite(costs.get(s.sku))||Number(costs.get(s.sku))<0),unknown=input.settlements.some(t=>t.kind==='unknown');
 const reserves=feeReserves(selected,actual.included,input.profiles,sales,allFees);
 // Missing recovery records do not make original sold COGS unknown. Keep those
 // costs in the estimate and never invent a returned-inventory credit.
 const complete=input.financeReady&&input.returnsReady&&input.costsReady&&!missing&&!unknown;
 const cogs=selected.reduce((n,s)=>n+s.quantity*(costs.get(s.sku)||0),0)-(input.recoveriesReady?refunds.recoveredCost:0);
 const reason=!input.costsReady||missing?'Product costs are missing':!input.returnsReady?'Refund data unavailable':!input.financeReady?'Fee data unavailable':unknown?'Unclassified settlement charges':!input.recoveriesReady?'Return credits unavailable; original COGS retained'+(reserves.total?'; includes estimated fees':''):reserves.total?'Includes estimated fees':'Provisional; unrecorded costs may remain';
 const profit=complete?round(revenue-cogs-actual.total-reserves.total):null;
 if(!Number.isFinite(revenue)||(profit!==null&&!Number.isFinite(profit)))throw Error('Invalid accounting amounts; summary not sent.');
 return {day,revenue,profit,units:selected.reduce((n,s)=>n+s.quantity,0),orders:new Set(selected.map(s=>s.order_id)).size,refunds:round(refunds.total),estimatedFees:reserves.total,partial:!complete||!input.recoveriesReady||reserves.total>0,reason};
}
export function dailySummaryMessage(s:DailySummary,siteUrl:string|null){
 const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 return {username:'SOUL',allowed_mentions:{parse:[]},...(siteUrl?{avatar_url:siteUrl+'/soul-iridescent-logo.jpg'}:{}),embeds:[{color:0xa855f7,author:{name:'📊 Daily Sales Summary'},description:'**Walmart · '+s.day+'**\n11:59 PM snapshot · America/New_York',fields:[{name:s.partial?'Revenue · provisional':'Revenue',value:money(s.revenue),inline:true},{name:'Estimated profit',value:s.profit===null?'Unavailable':money(s.profit),inline:true},{name:'Units sold',value:String(s.units),inline:true},{name:'Orders',value:String(s.orders),inline:true},{name:'Refunds',value:money(s.refunds),inline:true},{name:'Estimated profit margin',value:s.profit!==null&&s.revenue>0?(s.profit/s.revenue*100).toFixed(1)+'%':'—',inline:true},...(siteUrl?[{name:'Dashboard',value:'[View Walmart overview]('+siteUrl+')'}]:[])],footer:{text:'Soul · '+s.reason+' · Late platform updates may change totals'},timestamp:new Date().toISOString()}]};
}
