export type EbayLine={id:string;sku:string;title:string;quantity:number};
export type EbayOrder={id:string;createdAt:string;status:string;cancelled:boolean;currency:string;revenue:number;fees:number|null;refundPresent:boolean;lines:EbayLine[]};
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function amount(value:unknown,optional=false){if(value==null&&optional)return 0;const v=object(value),n=Number(v.value);if(v.currency!=='USD'||v.value==null||String(v.value).trim()===''||!Number.isFinite(n))throw Error('eBay import currently supports valid USD amounts only.');return n;}
export function parseEbayOrder(raw:unknown):EbayOrder{
 const row=object(raw),pricing=object(row.pricingSummary),payment=object(row.paymentSummary),cancel=object(row.cancelStatus);
 if(typeof row.orderId!=='string'||typeof row.creationDate!=='string'||!Number.isFinite(Date.parse(row.creationDate))||!Array.isArray(row.lineItems)||!row.lineItems.length)throw Error('eBay order identifiers or lines are incomplete.');
 const lines=row.lineItems.map(value=>{const line=object(value);if(typeof line.lineItemId!=='string'||!Number.isSafeInteger(line.quantity)||Number(line.quantity)<=0)throw Error('Invalid eBay order line.');return {id:line.lineItemId,sku:typeof line.sku==='string'&&line.sku?line.sku:'item:'+String(line.legacyItemId||line.lineItemId),title:String(line.title||'eBay item').slice(0,400),quantity:Number(line.quantity)};});
 // Discounts are signed negative amounts in the Fulfillment API. Taxes and
 // regulatory fees are excluded; this is merchandise + buyer shipping only.
 if(pricing.adjustment!=null&&amount(pricing.adjustment)!==0)throw Error('Adjusted eBay orders require reconciliation; this batch was not imported.');
 const revenue=amount(pricing.priceSubtotal)+amount(pricing.priceDiscount,true)+amount(pricing.deliveryCost,true)+amount(pricing.deliveryDiscount,true)+amount(pricing.adjustment,true);
 const refunds=Array.isArray(payment.refunds)?payment.refunds:[];
 const refundPresent=refunds.some(v=>object(v).refundStatus!=='FAILED')||row.lineItems.some(v=>{const refunds=object(v).refunds;return Array.isArray(refunds)&&refunds.some(r=>object(r).refundStatus!=='FAILED');})||String(row.orderPaymentStatus||'').includes('REFUND');
 return {id:row.orderId,createdAt:new Date(row.creationDate).toISOString(),status:String(row.orderPaymentStatus||'UNKNOWN'),cancelled:cancel.cancelState==='CANCELED',currency:'USD',revenue:Math.round(revenue*100)/100,fees:row.totalMarketplaceFee==null?null:amount(row.totalMarketplaceFee),refundPresent,lines};
}
export function summarizeEbay(orders:{data:EbayOrder;shipping_cost:number|null}[],costs:{sku:string;unit_cost:number}[]){
 const selected=orders.filter(row=>!row.data.cancelled&&['PAID','PARTIALLY_REFUNDED','FULLY_REFUNDED'].includes(row.data.status));
 const map=new Map(costs.map(c=>[c.sku,Number(c.unit_cost)]));let revenue=0,fees=0,cogs=0,shipping=0,units=0,missingCosts=0,missingShipping=0,missingFees=0,refundOrders=0;
 for(const row of selected){const order=row.data;revenue+=order.revenue;if(order.fees===null)missingFees++;else fees+=order.fees;if(row.shipping_cost===null)missingShipping++;else shipping+=Number(row.shipping_cost);if(order.refundPresent)refundOrders++;
 for(const line of order.lines){units+=line.quantity;if(!map.has(line.sku))missingCosts++;else cogs+=line.quantity*map.get(line.sku)!;}}
 const round=(n:number)=>Math.round(n*100)/100;
 const profit=missingCosts||missingShipping||missingFees||refundOrders?null:round(revenue-fees-cogs-shipping);
 return {revenue:round(revenue),fees:round(fees),cogs:round(cogs),shipping:round(shipping),units,orders:selected.length,missingCosts,missingShipping,missingFees,refundOrders,profit,margin:profit!==null&&revenue>0?profit/revenue*100:null};
}
