import type {CardData} from '../app/StreamSummaryCard';
import {walmartToday} from './walmart-period';
export type ContributionGroup={sku:string;name:string;method:string;units:number;revenue:number;cogs:number;missing:boolean};
export type ContributionBasis={financeReady:boolean;unknown:number;adjustments:Map<string,number>;recovered:Map<string,number>;actual:Map<string,number>;expected:Map<string,number>};
export function walmartProductContribution(group:ContributionGroup,basis:ContributionBasis){
 if(group.missing||!basis.financeReady||basis.unknown)return null;
 const key=group.sku+'|'+group.method;
 return group.revenue-(basis.adjustments.get(key)||0)-group.cogs+(basis.recovered.get(key)||0)-(basis.actual.get(key)||0)-(basis.expected.get(key)||0);
}
function productImage(name:string){
 const set=/\bLEGO\b/i.test(name)?name.match(/\b(\d{5,6})\b/)?.[1]:null;
 return set&&['76917','75394','75354','21350','71813','40912','76934'].includes(set)?`/products/lego/${set}.jpg`:null;
}
export function walmartPnlCard(input:{start:string;end:string;dates:string[];fulfillment:string;grossSales:number;profit:number|null;orders:number;units:number;returnsReady:boolean;estimatedFees:number;missingCosts:number;groups:ContributionGroup[];basis:ContributionBasis}):CardData{
 const dates=input.dates.map(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)?date:walmartToday(new Date(date))).sort();
 const start=input.start||dates[0]||input.end;
 const items=input.groups.flatMap(group=>{const profit=walmartProductContribution(group,input.basis);return profit===null?[]:[{skuId:group.sku+'|'+group.method,name:group.name+(group.method==='Unknown'?'':` · ${group.method}`),image:productImage(group.name),quantity:group.units,profit}];}).sort((a,b)=>b.profit-a.profit||a.skuId.localeCompare(b.skuId)).slice(0,3);
 const partial=input.profit===null||!input.returnsReady||input.estimatedFees!==0||input.missingCosts>0;
 return {start,end:input.end,total:input.grossSales,paidOrders:input.orders,unitsSold:input.units,topSellers:[],topProfitItems:items,profitEstimate:{profit:input.profit,partial,unpricedSkuCount:input.missingCosts,shippingMissingOrders:0},limited:false,
  summary:{title:'Walmart Summary',subtitle:`${input.fulfillment==='All'?'All fulfillment':input.fulfillment==='SF'?'Seller fulfilled':input.fulfillment} · Imported Walmart orders · America/New_York`,salesLabel:'GROSS SALES',profitLabel:!input.returnsReady?'PROFIT · PARTIAL':'EST. PROFIT',footer:!input.returnsReady?'Refunds incomplete · Product figures exclude unallocated charges':input.profit===null?'Profit unavailable · Missing costs or fee data':input.estimatedFees!==0?'Includes estimated fees · Product figures exclude unallocated charges':'Estimated profit · Product figures exclude unallocated charges',filenamePrefix:'soul-walmart-pnl'}};
}
