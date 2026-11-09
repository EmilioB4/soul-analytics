export type WalmartReturn={return_id:string;return_line_id:string;order_id:string;line_id:string;sku:string;refunded_qty:number;refund_product:number;refund_shipping:number;event_date:string;status:string;delivery_status:string;refund_status:string;is_keep_it:boolean;date_inferred:boolean};
export type ReturnRecovery={return_id:string;return_line_id:string;quantity:number;unit_cost:number};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown)=>String(v??'');
function money(v:unknown){const x=obj(v);if(x.currencyUnit&&x.currencyUnit!=='USD')throw Error('Unsupported return currency.');const n=Number(x.currencyAmount);if(x.currencyAmount==null||!Number.isFinite(n))throw Error('Return amount is missing or invalid.');return n;}
function day(value:unknown){const d=new Date(text(value));if(!Number.isFinite(d.getTime()))throw Error('Return event date is missing or invalid.');return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
export function parseWalmartReturns(value:unknown):WalmartReturn[]{
 const order=obj(value);if(!Array.isArray(order.returnOrderLines))throw Error('Return lines missing.');const rows:WalmartReturn[]=[];
 for(const raw of order.returnOrderLines){const line=obj(raw);
 const confirmed=(status:unknown)=>/^(REFUNDED|REFUND_COMPLETED)$/i.test(text(status));
 const tracking=(Array.isArray(line.currentTrackingStatuses)?line.currentTrackingStatuses:[]).map(obj).filter(x=>confirmed(x.currentRefundStatus));
 const trackingQty=tracking.reduce((n,x)=>n+Number(obj(x.quantity).measurementValue),0);
 const quantity=Number(line.refundedQty??(tracking.length?trackingQty:confirmed(line.currentRefundStatus)?obj(line.quantity).measurementValue:0));
 if(line.refundedQty==null&&tracking.length){const total=Number(obj(line.quantity).measurementValue);if(!Number.isSafeInteger(total)||quantity>total)throw Error('Refund tracking quantities exceed return quantity; reconciliation required.');}
if(!Number.isSafeInteger(quantity)||quantity<0)throw Error('Invalid refunded quantity.');if(!quantity||order.returnType==='REPLACEMENT'||order.returnType==='PREORDER')continue;
 const item=obj(line.item),id=text(order.returnOrderId),lineId=text(line.returnOrderLineNumber),po=text(line.purchaseOrderId),poLine=text(line.purchaseOrderLineNumber),sku=text(item.sku);if(!id||!lineId||!po||!poLine||!sku)throw Error('Return identifiers are incomplete.');
 let product=0,shipping=0;const charges=Array.isArray(line.charges)?line.charges:[];let foundProduct=false;
 for(const c of charges){const charge=obj(c);const category=text(charge.chargeCategory).toUpperCase();if(category==='PRODUCT')foundProduct=true;if(charge.isBillable===false)continue;if(category!=='PRODUCT'&&category!=='SHIPPING')continue;const sign=charge.isDiscount===true?-1:1;const amount=money(charge.chargePerUnit)*quantity*sign;if(category==='PRODUCT'){product+=amount;foundProduct=true;}else shipping+=amount;}
 if(!foundProduct)product=money(line.unitPrice)*quantity;if(product<0||shipping<0)throw Error('Unexpected negative return amount; review source charges.');
 const events=(Array.isArray(line.returnTrackingDetail)?line.returnTrackingDetail:[]).map(obj).filter(e=>/REFUND/i.test(text(e.eventTag))&&!/INIT|REQUEST|CANCEL|REJECT|PENDING|FAIL/i.test(text(e.eventTag))).sort((a,b)=>text(b.eventTime).localeCompare(text(a.eventTime)));
 const trackingDates=tracking.map(x=>x.statusTime).filter(Boolean);
 if(line.refundedQty==null&&tracking.length&&new Set(trackingDates.map(day)).size>1)throw Error('Refund quantities span multiple event dates; order-level reconciliation required.');
 const eventDate=events[0]?.eventTime||trackingDates[0]||line.statusTime||order.returnOrderDate;
 rows.push({return_id:id,return_line_id:lineId,order_id:po,line_id:poLine,sku,refunded_qty:quantity,refund_product:Math.round(product*100)/100,refund_shipping:Math.round(shipping*100)/100,event_date:day(eventDate),status:text(line.status),delivery_status:text(line.currentDeliveryStatus),refund_status:text(line.currentRefundStatus),is_keep_it:line.isKeepIt===true||line.returnExpectedFlag===false,date_inferred:!events.length&&!trackingDates.length});
 }
 return rows;
}
export async function downloadWalmartReturns(get:(path:string)=>Promise<unknown>,start:string,budgetMs=35000){
 let fetched=0,total:number|undefined;const orders=new Set<string>();
 const rows:WalmartReturn[]=[],seen=new Set<string>(),cursors=new Set<string>();const started=Date.now();let path='/v3/returns?limit=100';
 for(let page=0;page<100;page++){if(Date.now()-started>budgetMs)throw Error('Return sync time budget exceeded; no partial data returned.');const data=obj(await get(path));if(!Array.isArray(data.returnOrders))throw Error('Unrecognized Walmart returns response.');const count=Number(obj(data.meta).totalCount);if(!Number.isSafeInteger(count)||count<0)throw Error('Returns totalCount missing or invalid.');if(total!==undefined&&total!==count)throw Error('Returns changed during pagination; retry.');total=count;fetched+=data.returnOrders.length;for(const raw of data.returnOrders){const id=text(obj(raw).returnOrderId);if(!id||orders.has(id))throw Error('Duplicate or missing return ID during pagination.');orders.add(id);for(const row of parseWalmartReturns(raw)){const key=row.return_id+'|'+row.return_line_id;if(seen.has(key))throw Error('Duplicate return during pagination.');seen.add(key);rows.push(row);}}const next=text(obj(data.meta).nextCursor);if(!next){if(fetched!==total)throw Error('Incomplete returns pagination.');return rows;}if(cursors.has(next))throw Error('Repeated return pagination cursor.');cursors.add(next);if(!next.startsWith('?'))throw Error('Unrecognized return cursor.');path='/v3/returns'+next;}
 throw Error('Returns exceed pagination limit.');
}
