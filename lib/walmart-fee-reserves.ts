import type {WalmartFee,WalmartSale} from './walmart-finance';
export const feeComponents=['referral','fulfillment','prep','inbound','storage'] as const;
export type FeeComponent=typeof feeComponents[number];
export type FeeAssumptions={referral_pct:number;fulfillment_unit:number;prep_unit:number;inbound_unit:number;storage_unit:number;buffer_pct:number};
export type FeeProfile={sku:string;data:FeeAssumptions};
export const defaultFeeAssumptions:FeeAssumptions={referral_pct:15,fulfillment_unit:5.75,prep_unit:0,inbound_unit:0,storage_unit:0,buffer_pct:10};
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
export function normalizeFeeProfiles(profiles:FeeProfile[]):FeeProfile[]{
 const legacy={referral_pct:20,fulfillment_unit:8,prep_unit:2,inbound_unit:1,storage_unit:1,buffer_pct:20};
 return profiles.map(p=>({...p,data:Object.entries(legacy).every(([k,v])=>p.data[k as keyof FeeAssumptions]===v)?{...defaultFeeAssumptions}:p.data}));
}
// Expected fees exclude the optional safety cushion. Posted actuals always win.
export function expectedFees(sale:ReserveSale,profile:FeeAssumptions):Record<FeeComponent,number>{
 const q=Number(sale.quantity),factor=1;
 const wfs=sale.fulfillment==='WFS'||sale.fulfillment==='Unknown';
 return {referral:Math.max(0,Number(sale.revenue))*profile.referral_pct/100,fulfillment:wfs?q*profile.fulfillment_unit*factor:0,prep:wfs?q*profile.prep_unit*factor:0,inbound:wfs?q*profile.inbound_unit*factor:0,storage:wfs?q*profile.storage_unit*factor:0};
}
export function feeReserves(sales:ReserveSale[],actual:WalmartFee[],profiles:FeeProfile[]=[],historySales:ReserveSale[]=sales,historyFees:WalmartFee[]=actual){
 profiles=normalizeFeeProfiles(profiles);
 const samples=new Map<string,number[]>();
 const historyByOrder=new Map<string,ReserveSale[]>();for(const sale of historySales){const group=historyByOrder.get(sale.order_id)||[];group.push(sale);historyByOrder.set(sale.order_id,group);}
 const grouped=new Map<string,{sale:ReserveSale;category:FeeComponent;amount:number;quantity:number}>();
 for(const fee of historyFees){const category=feeComponent(fee.fee_type);if(!category||Number(fee.amount)<=0||!fee.order_id)continue;const matches=(historyByOrder.get(fee.order_id)||[]).filter(s=>(!fee.sku||fee.sku===s.sku)&&(!fee.line_id||fee.line_id===s.line_id));if(matches.length!==1)continue;const sale=matches[0],key=JSON.stringify([sale.order_id,sale.line_id,category]);const entry=grouped.get(key)||{sale,category,amount:0,quantity:0};entry.amount+=Number(fee.amount);entry.quantity=Math.max(entry.quantity,Number(fee.quantity)||0);grouped.set(key,entry);}
 for(const {sale,category,amount,quantity} of grouped.values()){if(quantity<=0&&Number(sale.quantity)>1)continue;const qty=quantity>0?quantity:Number(sale.quantity);const denominator=category==='referral'?Number(sale.revenue)*qty/Number(sale.quantity)/100:qty;if(denominator<=0)continue;const key=JSON.stringify([sale.sku,sale.fulfillment,category]);const values=samples.get(key)||[];values.push(amount/denominator);samples.set(key,values);}
 const evidence:{sku:string;fulfillment:string;category:FeeComponent;rate:number;source:string;samples:number}[]=[];
 const calibrated=(sale:ReserveSale)=>{const profile={...assumptionsFor(sale.sku,profiles)},override=profiles.some(p=>p.sku===sale.sku);for(const category of feeComponents){const values=[...(samples.get(JSON.stringify([sale.sku,sale.fulfillment,category]))||[])].sort((a,b)=>a-b);const key=category==='referral'?'referral_pct':`${category}_unit` as keyof FeeAssumptions;if(!override&&values.length){const mid=Math.floor(values.length/2);profile[key]=values.length%2?values[mid]:(values[mid-1]+values[mid])/2;}if(!evidence.some(e=>e.sku===sale.sku&&e.fulfillment===sale.fulfillment&&e.category===category))evidence.push({sku:sale.sku,fulfillment:sale.fulfillment,category,rate:profile[key],source:override?'SKU setting':values.length?'matched settlement median':'fallback setting',samples:values.length});}return profile;};
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
 const cushion=fees.reduce((n,f)=>n+Math.ceil(f.amount*100*assumptionsFor(f.sku||'',profiles).buffer_pct/100),0)/100;
 return {fees,cushion,evidence,total:fees.reduce((n,f)=>n+Math.round(f.amount*100),0)/100,estimatedOrders:new Set(fees.map(f=>f.order_id)).size,components:feeComponents.map(category=>({category,amount:entries.filter(e=>e.category===category).reduce((n,e)=>n+e.cents,0)/100}))};
}
