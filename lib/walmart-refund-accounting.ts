import type {WalmartReturn,ReturnRecovery} from './walmart-returns';
import type {WalmartTransaction,WalmartSale,WalmartFee} from './walmart-finance';
export function walmartRefundAccounting(returns:WalmartReturn[],settlements:WalmartTransaction[],sales:WalmartSale[],recoveries:ReturnRecovery[],start:string,end:string,filter='All'){
 const inRange=(date:string)=>(!start||date>=start)&&date<=end;
 const byOrder=new Map<string,WalmartSale[]>();for(const sale of sales){const list=byOrder.get(sale.order_id)||[];list.push(sale);byOrder.set(sale.order_id,list);}
 const eligible=(order:string|null,sku:string|null,line:string|null)=>filter==='All'||(order?byOrder.get(order)||[]:[]).some(s=>s.fulfillment===filter&&(!sku||s.sku===sku)&&(!line||s.line_id===line));
 const selected=returns.filter(r=>inRange(r.event_date)&&eligible(r.order_id,r.sku,r.line_id));
 // Deduplicate against the entire source history BEFORE selecting reporting dates.
 // Otherwise a refund on Nov 1 is deducted again when its settlement posts Nov 20.
 const pools=settlements.filter(t=>t.kind==='refund').map(t=>({t,remaining:Math.max(0,-Number(t.amount))}));
 for(const r of returns){for(const [shipping,amount] of [[false,r.refund_product],[true,r.refund_shipping]] as const){let rest=amount;for(const pool of pools){if(pool.t.order_id!==r.order_id||(pool.t.sku&&pool.t.sku!==r.sku)||(pool.t.line_id&&pool.t.line_id!==r.line_id)||(/^shipping/i.test(pool.t.fee_type)!==shipping))continue;const used=Math.min(pool.remaining,rest);pool.remaining-=used;rest-=used;if(rest<=0)break;}}}
 const events:WalmartFee[]=[],recoveryEvents:WalmartFee[]=[];let productRefunds=0,shippingRefunds=0,recoveredCost=0;
 for(const r of selected){productRefunds+=r.refund_product;shippingRefunds+=r.refund_shipping;
 for(const [category,amount] of [['product',r.refund_product],['shipping',r.refund_shipping]] as const)if(amount)events.push({order_id:r.order_id,line_id:r.line_id,sku:r.sku,fee_date:r.event_date,fee_type:`API ${category} refund`,amount});
 const recovery=recoveries.find(c=>c.return_id===r.return_id&&c.return_line_id===r.return_line_id);if(recovery&&!r.is_keep_it){const cost=Math.min(r.refunded_qty,Number(recovery.quantity))*Number(recovery.unit_cost);recoveredCost+=cost;recoveryEvents.push({order_id:r.order_id,line_id:r.line_id,sku:r.sku,fee_date:r.event_date,fee_type:'Confirmed returned inventory cost',amount:cost});}}
 // Only the portion not represented by API refunds falls back to posting date.
 for(const {t,remaining} of pools){if(!inRange(t.posted_date)||!eligible(t.order_id,t.sku,t.line_id))continue;const amount=Number(t.amount)>0?-Number(t.amount):remaining;if(!amount)continue;if(/^shipping/i.test(t.fee_type))shippingRefunds+=amount;else productRefunds+=amount;events.push({order_id:t.order_id,line_id:t.line_id,sku:t.sku,fee_date:t.posted_date,fee_type:t.fee_type,amount});}
 return {events,recoveryEvents,rows:selected,productRefunds,shippingRefunds,total:productRefunds+shippingRefunds,refundedUnits:selected.reduce((n,r)=>n+r.refunded_qty,0),recoveredCost};
}
