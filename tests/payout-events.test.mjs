import test from 'node:test';import assert from 'node:assert/strict';
import {tiktokPayoutEvents,walmartPayoutEvents,discordWebhookUrl,payoutMessage} from '../lib/payout-events.ts';
const payment=(extra={})=>({id:'p1',status:'PAID',amount:{currency:'USD',value:'123.45'},create_time:1794225600,...extra});
const statement=(extra={})=>({status:'OK',statusCode:200,payload:{sellerInfo:{paymentStatus:'ACTIVE'},accountSummary:{scheduledSettlementDate:'2026-11-10',closingBalance:100,paidToYou:0,...extra}}});
test('TikTok uses actual payment statuses and amounts; never labels processing as available',()=>{
 const [e]=tiktokPayoutEvents([payment({status:'PROCESSING'})],'shop');assert.equal(e.id,'shop:p1');assert.equal(e.stage,'processing');assert.equal(e.amount,123.45);assert.match(e.description,/not an available/);
 assert.equal(tiktokPayoutEvents([payment({status:'FAILED'}),payment({status:'UNSETTLED'})],'shop').length,0);
 assert.equal(tiktokPayoutEvents([payment()],'shop')[0].stage,'paid');
 for(const extra of [{amount:{currency:'EUR',value:'2'}},{amount:{currency:'USD',value:''}},{id:''},{create_time:0}])assert.throws(()=>tiktokPayoutEvents([payment(extra)],'shop'));
 assert.throws(()=>tiktokPayoutEvents([payment(),payment()],'shop'),/repeated/);
});
test('Walmart distinguishes scheduled balances from reported payouts and rejects malformed statements',()=>{
 const [scheduled]=walmartPayoutEvents(statement());assert.equal(scheduled.stage,'scheduled');assert.match(scheduled.description,/not confirmation/);
 const [paid]=walmartPayoutEvents(statement({paidToYou:75}));assert.equal(paid.stage,'paid');assert.equal(paid.amount,75);
 const inactive=statement();inactive.payload.sellerInfo.paymentStatus='INACTIVE';assert.equal(walmartPayoutEvents(inactive).length,0);
 for(const value of [{},statement({scheduledSettlementDate:'2026-02-30'}),statement({closingBalance:undefined}),statement({paidToYou:'bad'})])assert.throws(()=>walmartPayoutEvents(value));
});
test('webhook destinations are strictly pinned to Discord and mentions are disabled',()=>{
 const valid='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123';assert.equal(discordWebhookUrl(valid),valid);
 for(const url of [valid.replace('https:','http:'),valid.replace('discord.com','discord.com.evil.test'),valid+'?thread_id=123',valid.replace('discord.com','user@discord.com'),valid.replace('/api/','/other/'),'https://127.0.0.1/api/webhooks/123/abc'])assert.throws(()=>discordWebhookUrl(url));
 assert.deepEqual(payoutMessage(tiktokPayoutEvents([payment()],'shop')[0]).allowed_mentions,{parse:[]});
});
