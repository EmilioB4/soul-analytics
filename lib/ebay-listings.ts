import {XMLParser,XMLValidator} from 'fast-xml-parser';
export type EbayListing={id:string;title:string;sku:string|null;image:string|null;url:string;price:number|null;maxPrice:number|null;currency:string|null;quantity:number|null;format:'fixed'|'auction'|'other'};
const array=(v:any):any[]=>v==null?[]:Array.isArray(v)?v:[v];
const numeric=(v:unknown)=>typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
function amount(v:any){if(!v||typeof v!=='object'||typeof v['#text']!=='string'||!/^\d+(?:\.\d{1,4})?$/.test(v['#text'])||!/^[A-Z]{3}$/.test(v['@_currencyID']||''))return null;const value=Number(v['#text']);return Number.isFinite(value)?{value,currency:v['@_currencyID'] as string}:null;}
function imageUrl(value:unknown){if(typeof value!=='string')return null;try{const url=new URL(value);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&!url.port&&(['ebayimg.com','ebaystatic.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))){url.protocol='https:';return url.toString();}}catch{}return null;}
export function parseActiveListings(xml:string,page:number){
 if(Buffer.byteLength(xml)>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('eBay returned an invalid listings response.');
 const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,removeNSPrefix:true,processEntities:true});
 const root=parser.parse(xml)?.GetMyeBaySellingResponse;
 if(!root||!['Success','Warning'].includes(root.Ack))throw Error('eBay could not read active listings. Reconnect eBay in Settings → Connections and approve listing access.');
 const active=root.ActiveList;
 if(!active)return {items:[] as EbayListing[],page,total:0,pages:0,warning:root.Ack==='Warning'};
 const total=numeric(active.PaginationResult?.TotalNumberOfEntries),pages=numeric(active.PaginationResult?.TotalNumberOfPages);
 if(total===null||pages===null||(total>0&&pages<1))throw Error('eBay listing pagination is incomplete.');
 const items:EbayListing[]=array(active.ItemArray?.Item).map(item=>{
  if(typeof item.ItemID!=='string'||!/^\d{1,30}$/.test(item.ItemID)||typeof item.Title!=='string')throw Error('eBay listing identifiers are incomplete.');
  const format=['FixedPriceItem','StoresFixedPrice'].includes(item.ListingType)?'fixed':['Chinese','Dutch'].includes(item.ListingType)?'auction':'other';
  const prices=array(item.Variations?.Variation).map(v=>amount(v.StartPrice)).filter((v):v is {value:number;currency:string}=>v!==null);
  let price=amount(item.SellingStatus?.CurrentPrice)||amount(item.StartPrice),maxPrice:number|null=null;
  if(format==='fixed'&&prices.length&&prices.every(p=>p.currency===prices[0].currency)){price={value:Math.min(...prices.map(p=>p.value)),currency:prices[0].currency};maxPrice=Math.max(...prices.map(p=>p.value));}
  const pictures=[item.PictureDetails?.GalleryURL,...array(item.PictureDetails?.PictureURL)];
  return {id:item.ItemID,title:item.Title.slice(0,500),sku:typeof item.SKU==='string'?item.SKU.slice(0,500):null,image:pictures.map(imageUrl).find(Boolean)||null,url:'https://www.ebay.com/itm/'+item.ItemID,price:price?.value??null,maxPrice,currency:price?.currency??null,quantity:numeric(item.QuantityAvailable),format};
 });
 if(items.length!==Math.min(50,Math.max(0,total-(page-1)*50))||items.length>50||new Set(items.map(i=>i.id)).size!==items.length||items.length>total||(page<=pages&&total>0&&!items.length))throw Error('eBay returned incomplete listing data. Try refreshing.');
 return {items,page,total,pages,warning:root.Ack==='Warning'};
}
export async function fetchActiveListings(token:string,page:number){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Invalid listing page.');
 const response=await fetch('https://api.ebay.com/ws/api.dll',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','X-EBAY-API-CALL-NAME':'GetMyeBaySelling','X-EBAY-API-SITEID':'0','X-EBAY-API-COMPATIBILITY-LEVEL':'1489','X-EBAY-API-IAF-TOKEN':token},body:`<?xml version="1.0" encoding="utf-8"?><GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ActiveList><Include>true</Include><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList><SoldList><Include>false</Include></SoldList><UnsoldList><Include>false</Include></UnsoldList><ScheduledList><Include>false</Include></ScheduledList><SellingSummary><Include>false</Include></SellingSummary><HideVariations>false</HideVariations></GetMyeBaySellingRequest>`,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(response.status===429?'eBay listing rate limit reached. Try again shortly.':'eBay listings are unavailable. Check your connection in Settings → Connections.');
 const reader=response.body?.getReader();if(!reader)throw Error('Empty eBay listing response.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('eBay listing response exceeded the supported size.');}chunks.push(part.value);}
 return parseActiveListings(Buffer.concat(chunks).toString('utf8'),page);
}
