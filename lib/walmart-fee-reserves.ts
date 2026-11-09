import type {WalmartFee,WalmartSale} from './walmart-finance';
export const feeComponents=['referral','fulfillment','prep','inbound','storage'] as const;
export type FeeComponent=typeof feeComponents[number];
export type FeeAssumptions={referral_pct:number;fulfillment_unit:number;prep_unit:number;inbound_unit:number;storage_unit:number;buffer_pct:number};
export type FeeProfile={sku:string;data:FeeAssumptions};
export const defaultFeeAssumptions:FeeAssumptions={referral_pct:20,fulfillment_unit:8,prep_unit:2,inbound_unit:1,storage_unit:1,buffer_pct:20};
export type ReserveSale=WalmartSale&{quantity:number;revenue:number};
export function validateFeeAssumptions(input:unknown):FeeAssumptions{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid fee assumptions.');
 const raw=input as Record<string,unknown>;const out={...defaultFeeAssumptions};
 for(const key of Object.keys(out) as (keyof FeeAssumptions)[]){const value=raw[key];if((typeof value!=='number'&&typeof value!=='string')||value==='')throw Error(`Missing ${key}.`);const n=Number(value);if(!Number.isFinite(n)||n<0||n>(key.endsWith('_pct')?100:10000))throw Error(`Invalid ${key}.`);out[key]=n;}
 return out;
}
export function feeComponent(type:string):FeeComponent|null{
 if(/tax|refund|return processing|return label/i.test(type))return null;
 if(/prep|label/i.test(type))return 'prep';
 if(/inbound|transport|freight/i.test(type))return 'inbound';
 if(/storage/i.test(type))return 'storage';
 if(/referral|commission/i.test(type))return 'referral';
 if(/fulfill/i.test(type))return 'fulfillment';
 return null;
}
export function assumptionsFor(sku:string,profiles:FeeProfile[]){return profiles.find(p=>p.sku===sku)?.data||profiles.find(p=>p.sku==='*')?.data||defaultFeeAssumptions;}
// Planning assumptions, not a Walmart tariff/quote. Referral is already padded;
// buffer applies to the per-unit fulfillment/prep/inbound/storage reserves.
export function expectedFees(sale:ReserveSale,profile:FeeAssumptions):Record<FeeComponent,number>{
 const q=Number(sale.quantity),factor=1+profile.buffer_pct/100;
 const wfs=sale.fulfillment==='WFS'||sale.fulfillment==='Unknown';
 return {referral:Math.max(0,Number(sale.revenue))*profile.referral_pct/100,fulfillment:wfs?q*profile.fulfillment_unit*factor:0,prep:wfs?q*profile.prep_unit*factor:0,inbound:wfs?q*profile.inbound_unit*factor:0,storage:wfs?q*profile.storage_unit*factor:0};
}
export function feeReserves(sales:ReserveSale[],actual:WalmartFee[],profiles:FeeProfile[]=[],historySales:ReserveSale[]=sales,historyFees:WalmartFee[]=actual){
 const floors=new Map<string,Partial<Record<FeeComponent,number>>>();
 const historyByOrder=new Map<string,ReserveSale[]>();for(const sale of historySales){const group=historyByOrder.get(sale.order_id)||[];group.push(sale);historyByOrder.set(sale.order_id,group);}
 for(const fee of historyFees){const category=feeComponent(fee.fee_type);if(!category||Number(fee.amount)<=0||!fee.order_id)continue;const matches=(historyByOrder.get(fee.order_id)||[]).filter(s=>(!fee.sku||fee.sku===s.sku)&&(!fee.line_id||fee.line_id===s.line_id));if(matches.length!==1)continue;const sale=matches[0],qty=Number.isSafeInteger(Number(fee.quantity))&&Number(fee.quantity)>0?Number(fee.quantity):Number(sale.quantity);if(qty<=0)continue;const denominator=category==='referral'?Number(sale.revenue)*qty/Number(sale.quantity)/100:qty;if(denominator<=0)continue;const key=sale.sku+'|'+sale.fulfillment,observed=floors.get(key)||{};observed[category]=Math.max(observed[category]||0,Number(fee.amount)/denominator);floors.set(key,observed);}
 const calibrated=(sale:ReserveSale)=>{const profile={...assumptionsFor(sale.sku,profiles)},observed=floors.get(sale.sku+'|'+sale.fulfillment)||{};if(profile.referral_pct>0)profile.referral_pct=Math.max(profile.referral_pct,(observed.referral||0)*(1+profile.buffer_pct/100));for(const category of ['fulfillment','prep','inbound','storage'] as const){const key=`${category}_unit` as keyof FeeAssumptions;if(profile[key]>0)profile[key]=Math.max(profile[key],observed[category]||0);}return profile;};
 const lines=sales.map(s=>({sale:s,expected:expectedFees(s,calibrated(s)),covered:Object.fromEntries(feeComponents.map(c=>[c,0])) as Record<FeeComponent,number>}));
 const byOrder=new Map<string,typeof lines>();for(const line of lines){const group=byOrder.get(line.sale.order_id)||[];group.push(line);byOrder.set(line.sale.order_id,group);}
 const pools:{category:FeeComponent;sku:string|null;order:string|null;amount:number}[]=[];
 for(const fee of actual){const category=feeComponent(fee.fee_type);if(!category||Number(fee.amount)<0)continue;
  const matches=(fee.order_id?byOrder.get(fee.order_id)||[]:[]).filter(l=>(!fee.sku||fee.sku===l.sale.sku)&&(!fee.line_id||fee.line_id===l.sale.line_id));
  if(matches.length===1){const line=matches[0];const reported=Number(fee.quantity);const quantity=Number.isSafeInteger(reported)&&reported>0?reported:1;line.covered[category]=Math.min(Number(line.sale.quantity),Math.max(line.covered[category],quantity));}
  else if(Number(fee.amount)>0)pools.push({category,sku:fee.sku,order:fee.order_id,amount:Number(fee.amount)});
 }
 const entries=lines.flatMap(line=>feeComponents.map(category=>({sale:line.sale,category,cents:Math.max(0,Math.ceil(line.expected[category]*(1-line.covered[category]/Number(line.sale.quantity))*100-1e-7))})).filter(e=>e.cents>0));
 // Shared/ambiguous actual charges remain unallocated as actuals. They offset
 // matching planning reserves dollar-for-dollar to avoid adding the same cost twice.
 for(const pool of pools){const matching=entries.filter(e=>e.category===pool.category&&(!pool.sku||pool.sku===e.sale.sku)&&(!pool.order||pool.order===e.sale.order_id)&&e.cents>0);const total=matching.reduce((n,e)=>n+e.cents,0);let budget=Math.min(total,Math.round(pool.amount*100));let remaining=total;for(const entry of matching){const discount=remaining===entry.cents?budget:Math.min(entry.cents,Math.floor(budget*entry.cents/remaining));remaining-=entry.cents;entry.cents-=discount;budget-=discount;}}
 const fees:WalmartFee[]=entries.filter(e=>e.cents>0).map(e=>({order_id:e.sale.order_id,line_id:e.sale.line_id,sku:e.sale.sku,fee_date:e.sale.order_date,fee_type:`Estimated ${e.category}`,amount:e.cents/100}));
 return {fees,total:fees.reduce((n,f)=>n+Math.round(f.amount*100),0)/100,estimatedOrders:new Set(fees.map(f=>f.order_id)).size,components:feeComponents.map(category=>({category,amount:entries.filter(e=>e.category===category).reduce((n,e)=>n+e.cents,0)/100}))};
}
