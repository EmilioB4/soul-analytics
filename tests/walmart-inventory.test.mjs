import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryColumns,validateInventoryLot,importInventoryCsv,exportInventoryCsv,inventorySummary} from '../lib/walmart-inventory.ts';
const make=(extra={})=>validateInventoryLot({id:'lot-1',sku:'76917',name:'LEGO Skyline',stage:'received',qty:'10',sold:'3',left:'7',unit_cost:'25',...extra});
test('imports all 36 original columns and preserves quoted notes, commas, newlines and leading-zero SKUs',()=>{
 const lot=make({sku:'00123',notes:'Invoice "A",\nsecond line',payment:'Visa',wfs_net:'12.5',total_profit:'-5'});
 const csv='\uFEFF'+exportInventoryCsv([lot]);const rows=importInventoryCsv(csv);
 assert.equal(inventoryColumns.length,36);assert.deepEqual(rows,[lot]);assert.equal(rows[0].sku,'00123');
});
test('landed unit_cost is authoritative rather than inferred from discounts or unit_price',()=>{
 const lot=make({unit_price:'10',unit_cost:'12.60',discount_pct:'20',cashback_pct:'5',shipping:'3'});
 assert.equal(inventorySummary([lot]).costValue,88.2);
});
test('grouping preserves separate purchase lots and weights cost by units remaining',()=>{
 const a=make(),b=make({id:'lot-2',qty:'4',sold:'0',left:'4',stage:'ordered',unit_cost:'30'});
 const s=inventorySummary([a,b]);assert.equal(s.products.length,1);assert.equal(s.products[0].lots.length,2);assert.equal(s.left,11);assert.equal(s.received,7);assert.equal(s.ordered,4);assert.equal(s.costValue,295);assert.equal(s.sold,3);
});
test('missing costs are flagged, while a genuine zero unit cost is allowed',()=>{
 const s=inventorySummary([make({unit_cost:''}),make({id:'lot-2',unit_cost:'0'})]);assert.equal(s.missingCost,7);assert.equal(s.costValue,0);
});
test('stock stage definitions distinguish ordered, received, transferred and sold-out stock',()=>{
 const s=inventorySummary([make({qty:'2',sold:'0',left:'2'}),make({id:'lot-2',sku:'75354',stage:'sent_to_wfs'}),make({id:'lot-3',sku:'21350',stage:'at_wfs'})]);
 assert.equal(s.lowStock,1);assert.equal(s.received,9);assert.equal(s.other,7);
});
test('rejects missing columns, duplicate headers and unknown columns',()=>{
 assert.throws(()=>importInventoryCsv('id,sku\n1,76917'),/Missing column/);
 assert.throws(()=>importInventoryCsv('id,id\n1,1'),/duplicate column/);
 assert.throws(()=>importInventoryCsv('id,sku,name,stage,qty,sold,left,extra\n1,1,A,received,1,0,1,x'),/Unrecognized/);
});
test('rejects duplicate lot IDs in one file instead of overwriting one silently',()=>{
 assert.throws(()=>importInventoryCsv(exportInventoryCsv([make(),make()])),/duplicate lot ID/);
});
test('rejects oversold, inconsistent, fractional and invalid quantity/cost values',()=>{
 for(const values of [{sold:'11',left:'-1'},{left:'9'},{qty:'1.5'},{unit_cost:'bad'},{unit_cost:'-2'},{qty:''}])assert.throws(()=>make(values));
});
test('validates real calendar dates and percentages',()=>{
 assert.throws(()=>make({buy_date:'2026-02-30'}),/valid YYYY-MM-DD/);
 assert.throws(()=>make({cashback_pct:'101'}),/between 0 and 100/);
 assert.equal(make({buy_date:'2026-02-28'}).buy_date,'2026-02-28');
});
test('rejects malformed quoting and mismatched row lengths',()=>{
 assert.throws(()=>importInventoryCsv('id,sku\n"broken'),/unclosed/);
 assert.throws(()=>importInventoryCsv('id,sku,name,stage,qty,sold,left\n1,1,A,received,1,0'),/column count/);
});
test('export order matches the source format exactly without dropping optional fields',()=>{
 const lot=make({wm_sku:'seller-sku',wfs_shipment:'SHIP1',tags:'tag-a, tag-b',notes:'note'});
 const csv=exportInventoryCsv([lot]);assert.equal(csv.split('\r\n')[0],inventoryColumns.join(','));assert.deepEqual(importInventoryCsv(csv),[lot]);
});
