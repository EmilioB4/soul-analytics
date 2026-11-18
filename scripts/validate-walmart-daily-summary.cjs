const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {dailySummaryDay,calculateDailySummary,dailySummaryMessage}=require('../lib/walmart-daily-summary.ts');
for(const [instant,expected] of [
 ['2026-11-18T04:58:00Z','2026-11-16'],['2026-11-18T04:59:00Z','2026-11-17'],['2026-11-18T05:00:00Z','2026-11-17'],
 ['2026-07-02T03:59:00Z','2026-07-01'],['2026-07-02T04:00:00Z','2026-07-01'],
 ['2026-03-09T03:59:00Z','2026-03-08'],['2026-11-02T04:59:00Z','2026-11-01']
])assert.equal(dailySummaryDay(new Date(instant)),expected);
const day='2026-11-17',sale={order_id:'order',line_id:'1',order_date:day,sku:'sku',fulfillment:'WFS',quantity:2,revenue:100};
const fees=['referral','fulfillment'].map((fee_type,i)=>({order_id:'order',line_id:'1',sku:'sku',fee_date:day,fee_type,amount:i?11.5:15,quantity:2}));
const returned={return_id:'r',return_line_id:'1',order_id:'order',line_id:'1',sku:'sku',refunded_qty:1,refund_product:20,refund_shipping:0,event_date:day,is_keep_it:false};
const input={day,sales:[sale],fees,settlements:[],costs:[{sku:'sku',unit_cogs:20}],profiles:[],returns:[returned],recoveries:[{return_id:'r',return_line_id:'1',quantity:1,unit_cost:20}],financeReady:true,returnsReady:true,costsReady:true,recoveriesReady:true};
const summary=calculateDailySummary(input);
assert.equal(summary.revenue,80);assert.equal(summary.profit,33.5);assert.equal(summary.units,2);assert.equal(summary.orders,1);assert.equal(summary.estimatedFees,0);
assert.equal(calculateDailySummary({...input,costs:[]}).profit,null);
assert.equal(calculateDailySummary({...input,returnsReady:false}).profit,null);
assert.equal(calculateDailySummary({...input,financeReady:false}).profit,null);
const noCredits=calculateDailySummary({...input,recoveriesReady:false});
assert.equal(noCredits.profit,13.5);assert.equal(noCredits.partial,true);assert.match(noCredits.reason,/original COGS retained/);
const noRefunds=calculateDailySummary({...input,returns:[],recoveries:[],recoveriesReady:false});assert.equal(noRefunds.profit,33.5);
const noCreditMessage=dailySummaryMessage(noCredits,null).embeds[0];assert.equal(noCreditMessage.fields[1].value,'$13.50');assert.equal(noCreditMessage.fields[5].name,'Estimated profit margin');assert.equal(noCreditMessage.fields[5].value,'16.9%');
assert.equal(calculateDailySummary({...input,fees:[]}).partial,true);
assert.throws(()=>calculateDailySummary({...input,sales:[{...sale,revenue:NaN}]}));
const empty=calculateDailySummary({...input,sales:[],returns:[],recoveries:[],fees:[]});assert.equal(empty.revenue,0);assert.equal(empty.profit,0);
const message=dailySummaryMessage(summary,'https://example.test');assert.deepEqual(message.allowed_mentions.parse,[]);assert.equal(message.embeds[0].thumbnail,undefined);assert.equal(message.embeds[0].image,undefined);
assert.equal(message.embeds[0].fields[1].value,'$33.50');
assert.equal(dailySummaryMessage({...summary,profit:null},null).embeds[0].fields[1].value,'Unavailable');
console.log('Daily summary date, financial and message checks passed.');
