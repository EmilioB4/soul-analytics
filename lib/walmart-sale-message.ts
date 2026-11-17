export type WalmartSaleEvent={order_id:string;line_id:string;sku:string;product_name:string;quantity:number;revenue:number;fulfillment:string;sold_at:string|null;image?:string|null};
const usd=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export function saleTimestamp(value:unknown){if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;const date=new Date(n as string|number);return value!=null&&Number.isFinite(date.getTime())?date.toISOString():null;}
export function saleImage(value:unknown){if(typeof value!=='string')return null;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(/(^|\.)walmartimages\.com$/.test(url.hostname)||url.hostname==='i5.walmartimages.com')?url.toString():null;}catch{return null;}}
export function walmartSaleMessage(sale:WalmartSaleEvent,siteUrl:string|null){
 const clean=(v:string,max=200)=>String(v).replace(/[\u0000-\u001f`]/g,' ').slice(0,max);
 let image=saleImage(sale.image);const set=/\bLEGO\b/i.test(sale.product_name)?sale.product_name.match(/\b(\d{5,6})\b/)?.[1]:null;
 if(!image&&siteUrl&&set&&['76917','75394','75354','21350','71813','40912','76934'].includes(set))image=`${siteUrl}/products/lego/${set}.jpg`;
 const logo=siteUrl?`${siteUrl}/soul-iridescent-logo.jpg`:null;
 return {username:'SOUL',...(logo?{avatar_url:logo}:{}),allowed_mentions:{parse:[]},embeds:[{author:{name:'SOUL / WALMART SALES',...(logo?{icon_url:logo}:{})},title:'New Walmart sale',description:clean(sale.product_name,1800),color:0x9fe2f6,...(image?{thumbnail:{url:image}}:{}),fields:[{name:'Sold for',value:usd(sale.revenue),inline:true},{name:'Quantity',value:String(sale.quantity),inline:true},{name:'Unit price',value:usd(sale.revenue/sale.quantity),inline:true},{name:'Fulfillment',value:clean(sale.fulfillment),inline:true},{name:'SKU',value:clean(sale.sku)||'Unavailable',inline:true},{name:'Order',value:clean(sale.order_id),inline:true}],footer:{text:'Soul · Product sales before fees, tax & shipping'},timestamp:sale.sold_at||new Date().toISOString()}]};
}
