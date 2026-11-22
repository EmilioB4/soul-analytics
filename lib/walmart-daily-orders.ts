import type {WalmartOrderPricing} from './walmart-order-pricing';
export type DailyWalmartSale={order_id:string;line_id:string;order_date:string;sku:string;product_name:string;fulfillment:string;quantity:number;revenue:number;pricing?:WalmartOrderPricing|null};
export function dailyWalmartOrders(sales:DailyWalmartSale[],day:string,fulfillment='All'){
 const groups=new Map<string,{id:string;customerId:string|null;date:string;items:DailyWalmartSale[];sellerTotal:number;buyerTotal:number|null;funded:number;review:boolean}>();
 for(const sale of sales){if(sale.order_date!==day||(fulfillment!=='All'&&sale.fulfillment!==fulfillment))continue;
  const group=groups.get(sale.order_id)||{id:sale.order_id,customerId:null,date:day,items:[],sellerTotal:0,buyerTotal:0,funded:0,review:false};
  group.items.push(sale);group.sellerTotal+=Math.round(Number(sale.revenue)*100);if(sale.pricing){group.customerId||=sale.pricing.customerOrderId;group.funded+=Math.round(sale.pricing.walmartFunded*100);group.review||=sale.pricing.status==='review';}
  if(!sale.pricing||group.buyerTotal===null)group.buyerTotal=null;else group.buyerTotal+=Math.round(sale.pricing.buyerTotal*100);
  groups.set(sale.order_id,group);
 }
 return [...groups.values()].sort((a,b)=>b.id.localeCompare(a.id,undefined,{numeric:true})).map(g=>({...g,sellerTotal:g.sellerTotal/100,buyerTotal:g.buyerTotal===null?null:g.buyerTotal/100,funded:g.funded/100}));
}
