import {walmartAccessToken,walmartReport} from './walmart-api';
import {fetchWalmartPrimaryImage} from './walmart-product-image';
import {saleImage,type WalmartSaleEvent} from './walmart-sale-message';
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function listingItem(response:unknown,sku:string){
 const root=object(response),items=Array.isArray(root.ItemResponse)?root.ItemResponse:root.ItemResponse?[root.ItemResponse]:[root];
 return items.map(object).find(row=>row.sku===sku);
}
function itemImage(item:Record<string,unknown>){
 // Unlabelled gallery entries and generic imageUrl can be promotional graphics.
 for(const value of [item.primaryImageUrl,item.mainImageUrl]){const image=saleImage(value);if(image)return image;}
 const images=Array.isArray(item.images)?item.images:[];
 for(const raw of images){const entry=object(raw);if(!['PRIMARY','MAIN'].includes(String(entry.type||'').toUpperCase()))continue;const image=saleImage(entry.url??entry.imageUrl);if(image)return image;}
 return null;
}
// Match the seller's exact SKU; never guess from a similar product name.
export function listingSaleImage(response:unknown,sku:string){
 const item=listingItem(response,sku);return item?itemImage(item):null;
}
export function catalogSaleImage(response:unknown,itemId:string){
 const items=object(response).items;if(!itemId||!Array.isArray(items))return null;
 const matched=items.map(object).find(item=>String(item.itemId??'')===itemId);
 return matched?itemImage(matched):null;
}
// Cache only inside this owner's check. An unavailable Items permission or image
// must not prevent an otherwise valid sale notification from being delivered.
export function saleImageResolver(ownerId:string,deadline:number,onIssue:(message:string)=>void=()=>{}){
 let access:Promise<string>|undefined;
 const cache=new Map<string,Promise<string|null>>();
 const remaining=()=>Math.max(1,Math.min(3000,deadline-Date.now()));
 return async(sale:WalmartSaleEvent):Promise<WalmartSaleEvent>=>{
  const orderImage=sale.image_source==='order_primary'?saleImage(sale.image):null;
  if(!sale.sku||sale.sku==='UNKNOWN'||Date.now()>=deadline)return {...sale,image:orderImage};
  if(!cache.has(sale.sku))cache.set(sale.sku,(async()=>{
   try{
    access??=walmartAccessToken(ownerId,remaining());const token=await access;
    if(Date.now()>=deadline)return null;
    const response=await walmartReport('/v3/items/'+encodeURIComponent(sale.sku)+'?productIdType=SKU',token,'listing prices',remaining());
    const item=listingItem(response,sale.sku);if(!item){onIssue('Product image lookup returned no matching SKU.');return null;}
    const itemId=String(item.itemId??'');
    if(/^\d+$/.test(itemId)&&Date.now()<deadline){const hero=await fetchWalmartPrimaryImage(itemId,remaining());if(hero)return hero;}
    const direct=listingSaleImage(response,sale.sku);if(direct)return direct;
    if(Date.now()>=deadline){onIssue('Product image lookup exceeded its time budget.');return null;}
    const gtin=String(item.gtin??''),upc=String(item.upc??'');
    const identifier=/^\d{14}$/.test(gtin)?'gtin='+gtin:/^\d{12}$/.test(upc)?'upc='+upc:null;
    if(!identifier){onIssue('Walmart listing omitted identifiers for a primary product image.');return null;}
    const catalog=await walmartReport('/v3/items/walmart/search?'+identifier,token,'listing prices',remaining());
    const items=object(catalog).items;
    const matches=Array.isArray(items)?items.map(object):[];
    // An identifier-only catalog search is documented to resolve zero or one item.
    const matched=itemId?matches.find(row=>String(row.itemId??'')===itemId):matches.length===1?matches[0]:null;
    if(!matched){onIssue('Walmart catalog returned no unique matching product.');return null;}
    const resolvedId=String(matched.itemId??'');
    if(resolvedId!==itemId&&/^\d+$/.test(resolvedId)&&Date.now()<deadline){const hero=await fetchWalmartPrimaryImage(resolvedId,remaining());if(hero)return hero;}
    const image=itemImage(matched);
    if(!image)onIssue('Walmart returned no verified primary product image.');
    return image;
   }catch(error){
    const message=error instanceof Error?error.message:'';
    onIssue(/HTTP 403/.test(message)?'Product image lookup denied. Enable Items read access on your Walmart API key.':/HTTP 429/.test(message)?'Walmart rate-limited the product image lookup.':'Product image lookup failed or timed out.');
    return null;
   }
  })());
  const image=await cache.get(sale.sku);return {...sale,image:image??orderImage};
 };
}
