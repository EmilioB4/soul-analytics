export type CatalogItem={sku:string;price:number|null;currency:string|null};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export async function downloadWalmartCatalog(get:(path:string)=>Promise<unknown>,budgetMs=15000){
 const result=new Map<string,CatalogItem>();let cursor='*';const started=Date.now();
 for(let page=0;page<100;page++){
  if(Date.now()-started>budgetMs)throw Error('Listing-price lookup timed out.');
  const url=new URL('https://marketplace.walmartapis.com/v3/items');url.searchParams.set('limit','1000');url.searchParams.set('nextCursor',cursor);
  const body=obj(await get(url.pathname+url.search));if(!Array.isArray(body.ItemResponse))throw Error('Unrecognized Walmart catalog response.');
  for(const raw of body.ItemResponse){const item=obj(raw),sku=String(item.sku??'');if(!sku||result.has(sku))throw Error('Repeated/missing SKU in Walmart listing-price pagination.');const price=obj(item.price);const n=Number(price.amount);const currency=typeof price.currency==='string'&&/^[A-Z]{3}$/.test(price.currency)?price.currency:null;result.set(sku,{sku,price:price.amount!=null&&price.amount!==''&&(typeof price.amount==='number'||typeof price.amount==='string')&&Number.isFinite(n)&&n>=0&&currency?n:null,currency});}
  const total=Number(body.totalItems);if(body.totalItems!=null&&Number.isInteger(total)&&result.size>=total)return result;
  const next=typeof body.nextCursor==='string'?body.nextCursor:'';
  if(!next){if(body.totalItems!=null&&result.size<total)throw Error('Listing-price pagination is incomplete.');return result;}
  if(!body.ItemResponse.length)throw Error('Empty catalog page with a continuation cursor.');
  // Walmart may retain the same cursor while advancing its server-side page.
  cursor=next;
 }
 throw Error('Listing-price lookup exceeded its page limit.');
}
