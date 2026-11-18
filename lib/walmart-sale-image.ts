import {walmartAccessToken,walmartReport} from './walmart-api';
import {saleImage,type WalmartSaleEvent} from './walmart-sale-message';
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function listingItem(response:unknown,sku:string){
 const root=object(response),items=Array.isArray(root.ItemResponse)?root.ItemResponse:[root];
 return items.map(object).find(row=>row.sku===sku);
}
function itemImage(item:Record<string,unknown>){
 const images=Array.isArray(item.images)?item.images:[];
 for(const value of [item.primaryImageUrl,item.imageUrl,...images.map(image=>typeof image==='string'?image:object(image).url??object(image).imageUrl)]){
  const image=saleImage(value);if(image)return image;
 }
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
  const existing=saleImage(sale.image);if(existing)return {...sale,image:existing};
  if(!sale.sku||sale.sku==='UNKNOWN'||Date.now()>=deadline)return sale;
  if(!cache.has(sale.sku))cache.set(sale.sku,(async()=>{
   try{
    access??=walmartAccessToken(ownerId,remaining());const token=await access;
    if(Date.now()>=deadline)return null;
    const response=await walmartReport('/v3/items/'+encodeURIComponent(sale.sku)+'?productIdType=SKU',token,'listing prices',remaining());
    const direct=listingSaleImage(response,sale.sku);if(direct)return direct;
    // Get Item may omit images. Resolve its exact product identifier through
    // Walmart's catalog search, then also verify the returned Walmart item ID.
    const item=listingItem(response,sale.sku);if(!item){onIssue('Product image lookup returned no matching SKU.');return null;}
    if(Date.now()>=deadline){onIssue('Product image lookup exceeded its time budget.');return null;}
    const gtin=String(item.gtin??''),upc=String(item.upc??''),itemId=String(item.itemId??'');
    const identifier=/^\d{14}$/.test(gtin)?'gtin='+gtin:/^\d{12}$/.test(upc)?'upc='+upc:null;
    if(!identifier||!itemId){onIssue('Walmart listing omitted the identifiers needed for a product image.');return null;}
    const catalog=await walmartReport('/v3/items/walmart/search?'+identifier,token,'listing prices',remaining());
    const image=catalogSaleImage(catalog,itemId);
    if(!image)onIssue('Walmart catalog returned no supported image for the matching item ID.');
    return image;
   }catch(error){
    const message=error instanceof Error?error.message:'';
    onIssue(/HTTP 403/.test(message)?'Product image lookup denied. Enable Items read access on your Walmart API key.':/HTTP 429/.test(message)?'Walmart rate-limited the product image lookup.':'Product image lookup failed or timed out.');
    return null;
   }
  })());
  const image=await cache.get(sale.sku);return image?{...sale,image}:sale;
 };
}
