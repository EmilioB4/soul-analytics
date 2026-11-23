import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {saleImage,walmartSaleMessage} from '../lib/walmart-sale-message.ts';
const image='https://i5.walmartimages.com/asr/shrek.jpg';
function setup({fail=false,listing,catalog,hero=null}={}){
 const exports={},calls=[],pages=[];
 const api={walmartAccessToken:async owner=>{calls.push({owner});if(fail)throw Error('Items unavailable');return 'token-'+owner;},walmartReport:async(path,token)=>{calls.push({path,token});return path.includes('/walmart/search')?catalog:listing;}};
 const source=ts.transpileModule(fs.readFileSync(new URL('../lib/walmart-sale-image.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:id=>id==='./walmart-api'?api:id==='./walmart-product-image'?{fetchWalmartPrimaryImage:async id=>{pages.push(id);return hero;}}:{saleImage},Date,Map,Promise,URL,encodeURIComponent});return {...exports,calls,pages};
}
const sale={sku:'shrek/minifigs',order_id:'1',line_id:'1',product_name:'Shrek',quantity:1,revenue:37.69,fulfillment:'WFS',sold_at:null};
test('sale images require the exact SKU, safe image host and exact catalog item ID',()=>{
 const s=setup();assert.equal(s.listingSaleImage({ItemResponse:[{sku:'other',primaryImageUrl:image}]},sale.sku),null);
 assert.equal(s.listingSaleImage({ItemResponse:[{sku:sale.sku,primaryImageUrl:'https://evil.test/x',images:[{type:'PRIMARY',url:image}]}]},sale.sku),image);
 assert.equal(s.catalogSaleImage({items:[{itemId:12,primaryImageUrl:image}]},'13'),null);
 assert.equal(s.catalogSaleImage({items:[{itemId:12,primaryImageUrl:image}]},'12'),image);
});
test('listing image enrichment is cached per SKU and owner and reaches the Discord thumbnail',async()=>{
 const s=setup({listing:{ItemResponse:[{sku:sale.sku,primaryImageUrl:image}]}}),resolve=s.saleImageResolver('alice',Date.now()+10000);
 const result=await resolve(sale);await resolve(sale);assert.equal(result.image,image);
 assert.equal(s.calls.length,2);assert.equal(s.calls[0].owner,'alice');assert.match(s.calls[1].path,/shrek%2Fminifigs\?productIdType=SKU$/);
 assert.equal(walmartSaleMessage(result,null).embeds[0].thumbnail.url,image);
 const other=s.saleImageResolver('bob',Date.now()+10000);await other(sale);assert.equal(s.calls[2].owner,'bob');assert.equal(s.calls[3].token,'token-bob');
});
test('catalog fallback uses a listing identifier and verifies Walmart item ID',async()=>{
 const s=setup({listing:{ItemResponse:[{sku:sale.sku,gtin:'00012345678905',itemId:123}]},catalog:{items:[{itemId:123,images:[{type:'PRIMARY',url:image}]}]}});
 const result=await s.saleImageResolver('alice',Date.now()+10000)(sale);assert.equal(result.image,image);assert.equal(s.calls[2].path,'/v3/items/walmart/search?gtin=00012345678905');
 const wrong=setup({listing:{ItemResponse:[{sku:'wrong',gtin:'00012345678905',itemId:123}]}});assert.equal((await wrong.saleImageResolver('alice',Date.now()+10000)(sale)).image,null);assert.equal(wrong.calls.length,2);
});
test('image/API failure or expired budget does not block a sale; listing images override existing images and exact order images remain a safe fallback',async()=>{
 const failed=setup({fail:true});assert.equal((await failed.saleImageResolver('alice',Date.now()+10000)(sale)).product_name,'Shrek');
 const expired=setup();assert.equal((await expired.saleImageResolver('alice',0)(sale)).image,null);assert.equal(expired.calls.length,0);
 const fresh='https://i5.walmartimages.com/asr/live-listing.jpg';const existing=setup({listing:{ItemResponse:{sku:sale.sku,primaryImageUrl:fresh}}});assert.equal((await existing.saleImageResolver('alice',Date.now()+10000)({...sale,image})).image,fresh);assert.equal(existing.calls.length,2);const unavailable=setup({fail:true});assert.equal((await unavailable.saleImageResolver('alice',Date.now()+10000)({...sale,image,image_source:'order_primary'})).image,image);
});

test('missing image identifiers and API failures are reported without blocking the sale',async()=>{
 const issues=[];const missing=setup({listing:{ItemResponse:[{sku:sale.sku}]}});await missing.saleImageResolver('alice',Date.now()+10000,message=>issues.push(message))(sale);assert.match(issues[0],/omitted identifiers/);
 const failed=setup({fail:true});const result=await failed.saleImageResolver('alice',Date.now()+10000,message=>issues.push(message))(sale);assert.equal(result.product_name,'Shrek');assert.match(issues[1],/failed or timed out/);
});

test('verified product-page primary wins over promotional API/order images and generic galleries are ignored',async()=>{const promo='https://i5.walmartimages.com/asr/promotion.jpg',primary='https://i5.walmartimages.com/seo/full-product.jpg';const s=setup({hero:primary,listing:{ItemResponse:[{sku:sale.sku,itemId:'123',primaryImageUrl:promo,images:[{url:promo}]}]}});const result=await s.saleImageResolver('alice',Date.now()+10000)({...sale,image:promo});assert.equal(result.image,primary);assert.deepEqual(s.pages,['123']);assert.equal(s.listingSaleImage({ItemResponse:[{sku:sale.sku,imageUrl:promo,images:[{url:promo}]}]},sale.sku),null);const failed=setup({fail:true});assert.equal((await failed.saleImageResolver('alice',Date.now()+10000)({...sale,image:promo})).image,null);});
