import test from 'node:test';
import assert from 'node:assert/strict';
import {feeReserves,feeComponent} from '../lib/walmart-fee-reserves.ts';
import {parseWalmartTransaction,settlementFees,allocateWalmartFees,reportDate} from '../lib/walmart-finance.ts';
const raw=(type,amount,extra={})=>({'Transaction Key':'tx-1','Transaction Type':'Sale','Amount Type':type,Amount:amount,'Transaction Posted Timestamp':'11/08/2026','Purchase Order #':'PO1','Purchase Order line #':'1','Partner Item Id':'SKU1',...extra});
const parse=(r)=>parseWalmartTransaction(r,'11/09/2026',0);
test('actual fee debits, credits, prep, storage and fee taxes retain exact posted amounts',()=>{
 for(const type of ['Commission on Product','WFS Fulfillment Fee','Prep Fee','Storage Fee','Inbound Transportation','Commission Tax']){
  const r=parse(raw(type,'-12.34'));assert.equal(r.kind,'fee');assert.equal(settlementFees([r])[0].amount,12.34);
 }
 assert.equal(settlementFees([parse(raw('WFS Prep Fee','2.34'))])[0].amount,-2.34);
});
test('sales, refunds, sales taxes, transfers and unknown charges are not blindly counted as fees',()=>{
 assert.equal(parse(raw('Product Price','100')).kind,'sale');
 assert.equal(parse(raw('Product Price','100',{'Transaction Description':'WFS Fulfillment order'})).kind,'sale');
 assert.equal(parse(raw('Product Price','-100',{'Transaction Type':'Refund'})).kind,'refund');
 assert.equal(parse(raw('Tax on Product','8')).kind,'tax');
 assert.equal(parse(raw('','',{'Transaction Type':'PaymentSummary','Total Payable':'100'})).kind,'transfer');
 assert.equal(parse(raw('Unfamiliar entry','-4')).kind,'unknown');
 assert.deepEqual(settlementFees([parse(raw('Product Price','100')),parse(raw('Tax on Product','8'))]),[]);
});
test('malformed amounts and unsupported currencies abort instead of silently understating fees',()=>{
 for(const value of ['', 'bad'])assert.throws(()=>parse(raw('Prep Fee',value)),/Amount/);
 assert.throws(()=>parse(raw('Prep Fee','-4',{Currency:'CAD'})),/currency/);
 assert.equal(parse(raw('Prep Fee','($1,234.56)')).amount,-1234.56);
});
const sales=[
 {order_id:'PO1',line_id:'1',order_date:'2026-10-25',sku:'SKU1',fulfillment:'WFS'},
 {order_id:'PO2',line_id:'1',order_date:'2026-10-26',sku:'SKU1',fulfillment:'SF'},
 {order_id:'PO3',line_id:'1',order_date:'2026-08-01',sku:'SKU1',fulfillment:'WFS'}
];
const fee=(order_id,sku,amount,other={})=>({order_id,sku,amount,fee_date:'2026-11-08',fee_type:'Prep Fee',...other});
test('same SKU in WFS and SF is not charged twice; order date defines matched costs',()=>{
 const a=allocateWalmartFees(sales,[fee('PO1','SKU1',10),fee('PO2','SKU1',3),fee('PO3','SKU1',9)],'2026-10-01');
 assert.equal(a.total,13);assert.equal(a.byGroup.get('SKU1|WFS'),10);assert.equal(a.byGroup.get('SKU1|SF'),3);
 assert.equal(a.byOrder.get('PO1'),10);
});
test('account-level prep/storage is included once and never assigned to an arbitrary order',()=>{
 const fees=[fee('PO1','SKU1',10),fee(null,'SKU1',7),fee(null,null,5)];
 const all=allocateWalmartFees(sales,fees,'2026-10-01');
 assert.equal(all.total,22);assert.equal(all.unallocated,12);assert.equal(all.byGroup.get('SKU1|WFS'),10);
 const wfs=allocateWalmartFees(sales,fees,'2026-10-01','WFS');assert.equal(wfs.total,10);assert.equal(wfs.excludedShared,12);
});
test('ambiguous multi-product order fees stay unallocated at product level',()=>{
 const data=[...sales,{...sales[0],line_id:'2',sku:'SKU2'}];
 const a=allocateWalmartFees(data,[fee('PO1',null,10)]);
 assert.equal(a.total,10);assert.equal(a.unallocated,10);assert.equal(a.byOrder.get('PO1'),10);assert.equal(a.byGroup.size,0);
});
test('a line-specific fee can be attributed without a SKU',()=>{
 const data=[...sales,{...sales[0],line_id:'2',sku:'SKU2'}];
 const a=allocateWalmartFees(data,[fee('PO1',null,6,{line_id:'2'})]);
 assert.equal(a.byGroup.get('SKU2|WFS'),6);
});
test('US report dates parse predictably',()=>{
 assert.equal(reportDate('11/09/2026'),'2026-11-09');assert.equal(reportDate('2026-11-09'),'2026-11-09');assert.equal(reportDate('garbage'),null);assert.equal(reportDate('02/30/2026'),null);assert.equal(reportDate('20261109'),'2026-11-09');assert.equal(reportDate('11092026'),'2026-11-09');
});

test('generic fee amount labels retain the description needed to replace fulfillment estimates',()=>{
 const transaction=parse(raw('Fee','-6.25',{'Transaction Description':'WFS Fulfillment Fee'}));
 const actual=settlementFees([transaction]);
 assert.equal(feeComponent(actual[0].fee_type),'fulfillment');
 const sold=[{...sales[0],quantity:1,revenue:40}];
 const reserve=feeReserves(sold,actual);
 assert.equal(reserve.components.find(x=>x.category==='fulfillment').amount,0);
 assert.equal(actual[0].amount,6.25);
 assert.equal(reserve.components.find(x=>x.category==='referral').amount,6);
});
test('previously saved generic fee labels recover classification from raw fields without resync',()=>{
 const transaction={...parse(raw('Fee','-2',{'Transaction Description':'WFS Prep Fee'})),fee_type:'Fee'};
 const actual=settlementFees([transaction]);
 assert.equal(feeComponent(actual[0].fee_type),'prep');
 assert.equal(actual[0].amount,2);
 const credit=settlementFees([{...transaction,amount:1}]);
 assert.equal(credit[0].amount,-1);
});
