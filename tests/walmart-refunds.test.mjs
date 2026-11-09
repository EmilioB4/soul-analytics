import test from 'node:test';import assert from 'node:assert/strict';
import {parseWalmartReturns,downloadWalmartReturns} from '../lib/walmart-returns.ts';
import {walmartRefundAccounting} from '../lib/walmart-refund-accounting.ts';
import {walmartDateRange,newYorkMidnight} from '../lib/walmart-period.ts';
const raw=(extra={})=>({returnOrderId:'R1',returnType:'REFUND',returnOrderDate:'2026-11-01T12:00:00Z',returnOrderLines:[{returnOrderLineNumber:1,purchaseOrderId:'PO1',purchaseOrderLineNumber:1,item:{sku:'SKU1'},refundedQty:1,charges:[{chargeCategory:'PRODUCT',chargePerUnit:{currencyAmount:50,currencyUnit:'USD'},isBillable:true,tax:[{taxPerUnit:{currencyAmount:4,currencyUnit:'USD'}}]}],status:'COMPLETED',currentRefundStatus:'REFUNDED',statusTime:'2026-11-02T12:00:00Z',...extra}]});
const sale={order_id:'PO1',line_id:'1',sku:'SKU1',order_date:'2026-10-25',fulfillment:'WFS'};
test('confirmed refund amounts exclude sales tax and pending requests',()=>{const r=parseWalmartReturns(raw());assert.equal(r[0].refund_product,50);assert.equal(r[0].refunded_qty,1);assert.equal(parseWalmartReturns(raw({refundedQty:0,status:'INITIATED'})).length,0);});
test('non-billable product charges are not reintroduced through unit-price fallback',()=>{const r=parseWalmartReturns(raw({charges:[{chargeCategory:'PRODUCT',isBillable:false}],unitPrice:{currencyAmount:50,currencyUnit:'USD'}}));assert.equal(r[0].refund_product,0);});
test('replacement returns are not blindly treated as refunded sales',()=>{const x=raw();x.returnType='REPLACEMENT';assert.equal(parseWalmartReturns(x).length,0);});
test('API refunds and later settlement refunds are counted only once',()=>{const rows=parseWalmartReturns(raw());const ledger=[{kind:'refund',order_id:'PO1',line_id:'1',sku:'SKU1',posted_date:'2026-11-02',fee_type:'Product Price',amount:-50}];const r=walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-01','2026-11-08');assert.equal(r.total,50);assert.equal(r.events.reduce((n,e)=>n+e.amount,0),50);});
test('partial settlement amounts are topped up only by the still-uncovered API refund',()=>{const r=walmartRefundAccounting(parseWalmartReturns(raw()),[{kind:'refund',order_id:'PO1',line_id:'1',sku:'SKU1',posted_date:'2026-11-02',fee_type:'Product Price',amount:-20}],[sale],[],'2026-11-01','2026-11-08');assert.equal(r.total,50);});
test('refunding alone does not restore COGS; confirmed goods credit is bounded by actual refunded units',()=>{const rows=parseWalmartReturns(raw());assert.equal(walmartRefundAccounting(rows,[],[sale],[],'','9999-12-31').recoveredCost,0);const result=walmartRefundAccounting(rows,[],[sale],[{return_id:'R1',return_line_id:'1',quantity:3,unit_cost:20}],'','9999-12-31');assert.equal(result.recoveredCost,20);assert.equal(walmartRefundAccounting(parseWalmartReturns(raw({isKeepIt:true})),[],[sale],[{return_id:'R1',return_line_id:'1',quantity:1,unit_cost:20}],'','9999-12-31').recoveredCost,0);});
test('refund accounting follows refund event date, not the original sale date',()=>{const rows=parseWalmartReturns(raw());assert.equal(walmartRefundAccounting(rows,[],[sale],[],'2026-11-01','2026-11-08').total,50);assert.equal(walmartRefundAccounting(rows,[],[sale],[],'2026-10-01','2026-10-31').total,0);});
test('incomplete and repeated return pages fail instead of silently returning partial refunds',async()=>{await assert.rejects(downloadWalmartReturns(async()=>({meta:{totalCount:2,nextCursor:''},returnOrders:[raw()]}),'2026-10-01'),/Incomplete/);const pages=[{meta:{totalCount:2,nextCursor:'?offset=1'},returnOrders:[raw()]},{meta:{totalCount:2,nextCursor:''},returnOrders:[raw()]}];await assert.rejects(downloadWalmartReturns(async()=>pages.shift(),'2026-10-01'),/Duplicate/);});
test('rolling dates exclude the unfinished New York day and support exact custom bounds',()=>{assert.deepEqual(walmartDateRange('30','','',new Date('2026-11-09T17:00:00Z')),{start:'2026-10-10',end:'2026-11-08',label:'2026-10-10 – 2026-11-08'});assert.equal(walmartDateRange('custom','2026-10-01','2026-10-31').end,'2026-10-31');assert.throws(()=>walmartDateRange('custom','2026-11-01','2026-10-01'));});
test('New York sync boundaries honor daylight saving offsets',()=>{assert.equal(newYorkMidnight('2026-10-10'),'2026-10-10T04:00:00.000Z');assert.equal(newYorkMidnight('2026-11-08'),'2026-11-08T05:00:00.000Z');});

test('returns compatibility request uses documented unfiltered pagination',async()=>{const paths=[];await downloadWalmartReturns(async path=>{paths.push(path);return {meta:{totalCount:0,nextCursor:''},returnOrders:[]};},'2026-10-10');assert.equal(paths[0],'/v3/returns?limit=100');assert.ok(!paths[0].includes('Modified'));});

test('later settlement does not deduct an API refund again in a separate date range',()=>{
 const rows=parseWalmartReturns(raw());const ledger=[{kind:'refund',order_id:'PO1',line_id:'1',sku:'SKU1',posted_date:'2026-11-20',fee_type:'Product Price',amount:-50}];
 assert.equal(walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-01','2026-11-08').total,50);
 assert.equal(walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-09','2026-11-30').total,0);
 assert.equal(walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-01','2026-11-30').total,50);
});
test('unmatched settlement remainder and shipping refunds remain accounted for',()=>{
 const rows=parseWalmartReturns(raw({charges:[{chargeCategory:'PRODUCT',chargePerUnit:{currencyAmount:50}},{chargeCategory:'SHIPPING',chargePerUnit:{currencyAmount:5}}]}));
 const ledger=[{kind:'refund',order_id:'PO1',line_id:'1',sku:'SKU1',posted_date:'2026-11-20',fee_type:'Product Price',amount:-70},{kind:'refund',order_id:'PO1',line_id:'1',sku:'SKU1',posted_date:'2026-11-20',fee_type:'Shipping',amount:-5}];
 const early=walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-01','2026-11-08');
 assert.equal(early.total,55);assert.equal(walmartRefundAccounting(rows,ledger,[sale],[],'2026-11-09','2026-11-30').total,20);
});
test('multi-unit return tracking counts only confirmed refunds when parent quantity is absent',()=>{
 const result=parseWalmartReturns(raw({refundedQty:undefined,quantity:{measurementValue:3},currentRefundStatus:'REFUND_INITIATED',currentTrackingStatuses:[{currentRefundStatus:'REFUND_COMPLETED',quantity:{measurementValue:2},statusTime:'2026-11-03T12:00:00Z'},{currentRefundStatus:'REFUND_INITIATED',quantity:{measurementValue:1}}]}));
 assert.equal(result[0].refunded_qty,2);assert.equal(result[0].refund_product,100);assert.equal(result[0].event_date,'2026-11-03');
 assert.equal(parseWalmartReturns(raw({refundedQty:0,currentTrackingStatuses:[{currentRefundStatus:'REFUND_COMPLETED',quantity:{measurementValue:2}}]})).length,0);
 assert.equal(parseWalmartReturns(raw({refundedQty:undefined,currentRefundStatus:'COMPLETED',quantity:{measurementValue:1}})).length,0);
});
test('ambiguous multi-day or excessive tracked quantities require reconciliation',()=>{
 const statuses=[{currentRefundStatus:'REFUND_COMPLETED',quantity:{measurementValue:1},statusTime:'2026-11-02T12:00:00Z'},{currentRefundStatus:'REFUND_COMPLETED',quantity:{measurementValue:1},statusTime:'2026-11-03T12:00:00Z'}];
 assert.throws(()=>parseWalmartReturns(raw({refundedQty:undefined,quantity:{measurementValue:2},currentTrackingStatuses:statuses})),/multiple event dates/);
 assert.throws(()=>parseWalmartReturns(raw({refundedQty:undefined,quantity:{measurementValue:1},currentTrackingStatuses:statuses})),/exceed/);
});
