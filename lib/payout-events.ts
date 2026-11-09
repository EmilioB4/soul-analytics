export type PayoutEvent={platform:'tiktok'|'walmart';id:string;stage:'processing'|'paid'|'scheduled';amount:number;currency:'USD';date:string;description:string};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const dollars=(v:unknown)=>{if(v==null||v==='')throw Error('Payout amount missing.');const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error('Invalid payout amount.');return Math.round(n*100)/100;};
const date=(v:unknown)=>{const s=String(v??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Invalid payout date.');return s;};
export function tiktokPayoutEvents(rows:unknown[],shop:string):PayoutEvent[]{
 const events:PayoutEvent[]=[];const ids=new Set<string>();
 for(const raw of rows){const p=obj(raw);if(p.status!=='PAID'&&p.status!=='PROCESSING')continue;
 if(obj(p.amount).currency!=='USD')throw Error('Payout alerts currently require USD payments.');
 const id=String(p.id??'');if(!id||id.length>200||ids.has(id))throw Error('Missing or repeated TikTok payment ID.');ids.add(id);
 const amount=dollars(obj(p.amount).value),time=Number(p.paid_time||p.create_time);if(!Number.isFinite(time)||time<=0)throw Error('Invalid payment timestamp.');
 if(amount>0)events.push({platform:'tiktok',id:`${shop}:${id}`,stage:p.status==='PAID'?'paid':'processing',amount,currency:'USD',date:new Date(time*1000).toISOString().slice(0,10),description:p.status==='PAID'?'TikTok reports this payment as transferred. Bank receipt is not verified.':'TikTok is processing this payment. It is not an available-to-withdraw balance.'});
 }return events;
}
export function walmartPayoutEvents(value:unknown):PayoutEvent[]{
 const body=obj(value);if(body.status!=='OK'||Number(body.statusCode)!==200)throw Error('Walmart payment statement unavailable.');
 const payload=obj(body.payload),account=obj(payload.accountSummary);if(!Object.keys(account).length)throw Error('Walmart statement account summary missing.');
 const cycle=date(account.scheduledSettlementDate),events:PayoutEvent[]=[],paid=dollars(account.paidToYou);
 if(paid>0)events.push({platform:'walmart',id:cycle,stage:'paid',amount:paid,currency:'USD',date:cycle,description:'Walmart reports Paid to you for this settlement cycle. This is not bank receipt confirmation.'});
 const balance=dollars(Math.max(0,Number(account.closingBalance)));if(account.closingBalance==null||account.closingBalance==='')throw Error('Walmart closing balance missing.');
 if(!paid&&balance>0&&obj(payload.sellerInfo).paymentStatus==='ACTIVE')events.push({platform:'walmart',id:cycle,stage:'scheduled',amount:balance,currency:'USD',date:cycle,description:'Reported closing balance and scheduled settlement date. Holds, reserves or later adjustments may change the payout; this is not confirmation that funds can be withdrawn.'});
 return events;
}
export function discordWebhookUrl(value:string){
 let u:URL;try{u=new URL(value.trim());}catch{throw Error('Enter a valid Discord webhook URL.');}
 if(u.protocol!=='https:'||u.hostname!=='discord.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/api(?:\/v\d+)?\/webhooks\/\d{10,25}\/[A-Za-z0-9_-]{20,200}$/.test(u.pathname))throw Error('Use an HTTPS discord.com/api/webhooks URL without query parameters.');
 return u.toString();
}
type MessageOptions={siteUrl?:string|null;observedAt?:string};
function brandedMessage<T extends Record<string,unknown>>(embed:T,options:MessageOptions={}){
 const logo=options.siteUrl?`${options.siteUrl}/soul-iridescent-logo.jpg`:undefined;
 return {username:'SOUL',...(logo?{avatar_url:logo}:{}),allowed_mentions:{parse:[]},embeds:[{author:{name:'SOUL / PAYOUTS',...(logo?{icon_url:logo}:{})},...embed,footer:{text:'Soul · Seller intelligence'},timestamp:options.observedAt||new Date().toISOString(),...(options.siteUrl?{url:options.siteUrl}:{})}]};
}
export function payoutMessage(event:PayoutEvent,options:MessageOptions={}){
 const platform=event.platform==='tiktok'?'TikTok Shop':'Walmart';
 const status=event.stage==='paid'?'Sent':event.stage==='processing'?'Payout initiated':'Scheduled';
 const note=event.stage==='paid'?'Reported sent by the platform. Bank arrival may take longer.':event.stage==='processing'?'TikTok has initiated this payout and is processing the transfer.':'Expected settlement; amount and timing may change.';
 return brandedMessage({title:new Intl.NumberFormat('en-US',{style:'currency',currency:event.currency}).format(event.amount),description:`**${platform}**\n${note}`,color:event.stage==='scheduled'?0xc39bff:0x7be9ef,fields:[{name:'Status',value:status,inline:true},{name:event.platform==='walmart'?'Settlement date':'Payment date',value:event.date,inline:true}]},options);
}
export function payoutTestMessage(options:MessageOptions={}){
 return brandedMessage({title:'You’re connected',description:'Payout updates will arrive here.\nThis is a test notification.',color:0x7be9ef},options);
}
