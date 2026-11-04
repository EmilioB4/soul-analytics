import {NextRequest,NextResponse} from 'next/server';
import {db,owner} from '../../../../lib/tiktok';
export const runtime='nodejs';
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const client=db();
  const [itemsResult,costsResult,ordersResult,finResult]=await Promise.all([
   client.from('tiktok_order_items').select('shop_id,order_id,sku_id,product_name,sku_name,sku_image,quantity,unit_sale_price,currency').eq('owner_id',user.id).limit(5000),
   client.from('tiktok_product_costs').select('shop_id,sku_id,unit_cogs').eq('owner_id',user.id).limit(5000),
   client.from('tiktok_orders').select('shop_id,order_id,status,created_at').eq('owner_id',user.id).limit(5000),
   client.from('tiktok_order_finance').select('shop_id,order_id,settlement_amount,shipping_cost_amount,currency').eq('owner_id',user.id).limit(5000)
  ]);
  if(itemsResult.error||costsResult.error||ordersResult.error||finResult.error)return NextResponse.json({error:'Product/finance tables unavailable. Run supabase/product_finance.sql first.'},{status:503});
  const costs=new Map((costsResult.data||[]).map(c=>[`${c.shop_id}:${c.sku_id}`,Number(c.unit_cogs)]));
  const orders=new Map((ordersResult.data||[]).map(o=>[`${o.shop_id}:${o.order_id}`,o]));
  const finances=new Map((finResult.data||[]).map(f=>[`${f.shop_id}:${f.order_id}`,f]));
  type Prod={shopId:string;skuId:string;name:string;variant:string;image:string|null;quantity:number;sales:number|null;unitCost:number|null;currency:string;estimatedProfit:number|null;estimatedFee:number|null;totalCogs:number|null;avgPrice:number|null};
  const products=new Map<string,Prod>();
  const orderCosts=new Map<string,{value:number;complete:boolean}>();
  for(const line of itemsResult.data||[]){
   const ok=orders.get(`${line.shop_id}:${line.order_id}`);
   if(!ok||['UNPAID','CANCELLED'].includes(ok.status))continue;
   const key=`${line.shop_id}:${line.sku_id}`;
   const count=Number(line.quantity)||1;
   const unitCost=costs.get(key)??null;
   const unitPrice=line.unit_sale_price==null?null:Number(line.unit_sale_price);
   const p=products.get(key)||{shopId:line.shop_id,skuId:line.sku_id,name:line.product_name,variant:line.sku_name||'',image:line.sku_image||null,quantity:0,sales:0,unitCost,currency:line.currency,estimatedProfit:null,estimatedFee:null,totalCogs:null,avgPrice:null};
   p.quantity+=count;
   if(unitPrice==null||p.sales==null)p.sales=null;else p.sales+=count*unitPrice;
   if(!p.image&&line.sku_image)p.image=line.sku_image;
   products.set(key,p);
   const orderKey=`${line.shop_id}:${line.order_id}`;
   const current=orderCosts.get(orderKey)||{value:0,complete:true};
   if(unitCost===null)current.complete=false;else current.value+=count*unitCost;
   orderCosts.set(orderKey,current);
  }
  let settled=0,priced=0,settledProfit=0,unpriced=0;
  for(const [key,cogs] of orderCosts){
   const f=finances.get(key);
   if(!f||f.settlement_amount==null||f.currency!=='USD')continue;
   settled++;
   if(!cogs.complete){unpriced++;continue;}
   priced++;
   settledProfit+=Number(f.settlement_amount)-cogs.value;
  }
  // Order-level net seller shipping is signed by TikTok (negative = cost, positive = credit).
  // Only subtract shipping for orders with complete known COGS so missing product costs stay excluded.
  let shippingExpense=0,shippingCoveredOrders=0,shippingMissingOrders=0;
  for(const [orderKey,orderCost] of orderCosts){
   if(!orderCost.complete)continue;
   const finance=finances.get(orderKey);
   if(finance?.currency==='USD'&&finance.shipping_cost_amount!=null&&Number.isFinite(Number(finance.shipping_cost_amount))){
    shippingExpense-=Number(finance.shipping_cost_amount);shippingCoveredOrders++;
   }else shippingMissingOrders++;
  }
  let pricedProductCount=0,missingCostProductCount=0,estimatedProductSales=0,estimatedTikTokFees=0,estimatedCOGS=0,estimatedProfit=0;
  const listing=[...products.values()].sort((a,b)=>b.quantity-a.quantity).map(p=>{
   const valid=p.sales!==null&&p.currency==='USD'&&p.unitCost!==null;
   const avgPrice=p.sales!==null&&p.quantity>0?money(p.sales/p.quantity):null;
   const fee=valid?money(p.sales!*0.06):null;
   const cogs=valid?money(p.quantity*p.unitCost!):null;
   const profit=valid?money(p.sales!-fee!-cogs!):null;
   if(valid){pricedProductCount++;estimatedProductSales+=p.sales!;estimatedTikTokFees+=fee!;estimatedCOGS+=cogs!;estimatedProfit+=profit!;}else missingCostProductCount++;
   return {...p,sales:p.sales===null?null:money(p.sales),avgPrice,estimatedFee:fee,totalCogs:cogs,estimatedProfit:profit};
  });
  return NextResponse.json({products:listing,metrics:{settledOrderCount:settled,pricedSettledOrders:priced,missingCostSettledOrders:unpriced,settledContributionProfit:priced?money(settledProfit):null,profitIsPartial:priced!==settled,feeRate:0.06,estimatedProductSales:money(estimatedProductSales),estimatedTikTokFees:money(estimatedTikTokFees),estimatedCOGS:money(estimatedCOGS),estimatedProfit:pricedProductCount?money(estimatedProfit-shippingExpense):null,shippingExpense:money(shippingExpense),shippingCoveredOrders,shippingMissingOrders,pricedProductCount,missingCostProductCount,orderItems:(itemsResult.data||[]).length,financeRecords:(finResult.data||[]).length,limitReached:[itemsResult.data,ordersResult.data,finResult.data].some(x=>(x||[]).length===5000)}});
 }catch{return NextResponse.json({error:'Unable to retrieve product profitability'},{status:503});}
}
export async function PUT(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json();
  if(typeof body.shopId!=='string'||typeof body.skuId!=='string'||!body.shopId||!body.skuId||body.shopId.length>200||body.skuId.length>200)return NextResponse.json({error:'Invalid product identifier'},{status:400});
  if(typeof body.unitCost!=='number'||!Number.isFinite(body.unitCost)||body.unitCost<0||body.unitCost>1000000||Math.abs(Math.round(body.unitCost*100)-body.unitCost*100)>0.00001)return NextResponse.json({error:'Enter a nonnegative cost with no more than two decimal places'},{status:400});
  const client=db();
  const {data:existing,error:lookupError}=await client.from('tiktok_order_items').select('sku_id').eq('owner_id',user.id).eq('shop_id',body.shopId).eq('sku_id',body.skuId).limit(1);
  if(lookupError)return NextResponse.json({error:'Products table unavailable'},{status:503});
  if(!existing?.length)return NextResponse.json({error:'Product not found in your imported shop orders'},{status:404});
  const {error}=await client.from('tiktok_product_costs').upsert({owner_id:user.id,shop_id:body.shopId,sku_id:body.skuId,unit_cogs:body.unitCost,updated_at:new Date().toISOString()},{onConflict:'owner_id,shop_id,sku_id'});
  if(error)throw Error('Could not save COGS');
  return NextResponse.json({saved:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save cost'},{status:500});}
}
