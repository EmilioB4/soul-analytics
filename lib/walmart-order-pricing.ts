export type WalmartOrderPricing={version:1;buyerProduct:number;buyerTotal:number;walmartFunded:number;originalProduct:number|null;status:'standard'|'walmart_funded'|'review';customerOrderId:string|null};
const obj=(v:unknown):Record<string,any>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const arr=(v:unknown):unknown[]=>v==null?[]:Array.isArray(v)?v:[v];
function amount(v:unknown){const row=obj(v),raw=row.amount??row.value??v;
 if(raw==null||typeof raw==='object'||String(raw).trim()===''||(row.currency&&row.currency!=='USD'))throw Error('Invalid Walmart order currency or amount.');
 const n=Number(raw);if(!Number.isFinite(n)||!Number.isSafeInteger(Math.round(n*100))||n<0||Math.abs(n*100-Math.round(n*100))>.000001)throw Error('Invalid Walmart order amount.');return Math.round(n*100);
}
export function walmartLinePricing(line:unknown,quantity:number,customerOrderId:unknown){
 if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Invalid Walmart order quantity.');
 const row=obj(line),charges=arr(obj(row.charges).charge);let product=0,buyerTotal=0;
 for(const c of charges){const charge=obj(c),value=amount(charge.chargeAmount);buyerTotal+=value;if(String(charge.chargeType).toUpperCase()==='PRODUCT')product+=value;
  const tax=obj(charge.tax);if(tax.taxAmount!=null)buyerTotal+=amount(tax.taxAmount);
 }
 const incentive=obj(row.incentive),funded=String(incentive.type||'').toLowerCase().replace(/[^a-z]/g,'')==='walmartfunded';
 let revenue=product,originalProduct:number|null=null,funding=0,status:WalmartOrderPricing['status']='standard';
 if(funded){
  status='review';
  try{
   const original=amount(incentive.originalPrice),credit=amount(incentive.walmartFundedIncentive);
   // API amount descriptions do not establish a quantity basis. Accept only
   // arithmetic-consistent whole-line or per-unit interpretations, never today's catalog price.
   const originalTotals=[...new Set([original,original*quantity])],creditTotals=[...new Set([credit,credit*quantity])];
   const candidates=originalTotals.flatMap(o=>creditTotals.filter(c=>o>0&&c<=o&&(product+c===o||product===o)).map(c=>({original:o,credit:c})));
   const distinct=[...new Map(candidates.map(c=>[c.original+':'+c.credit,c])).values()];
   if(distinct.length===1){originalProduct=distinct[0].original;funding=distinct[0].credit;revenue=originalProduct;status='walmart_funded';
    // PRODUCT may already include the funding. Preserve actual buyer-paid total
    // by subtracting the documented incentive only in that case.
    if(product===originalProduct)buyerTotal-=funding;
   }
  }catch{/* Keep the source charge, flag review and never fabricate funding. */}
 }
 const pricing:WalmartOrderPricing={version:1,buyerProduct:(status==='walmart_funded'?revenue-funding:product)/100,buyerTotal:buyerTotal/100,walmartFunded:funding/100,originalProduct:originalProduct===null?null:originalProduct/100,status,customerOrderId:typeof customerOrderId==='string'?customerOrderId:null};
 return {revenue:revenue/100,pricing};
}
export function walmartPricingReview(sales:{pricing?:WalmartOrderPricing|null}[],settlements:{kind:string;raw?:Record<string,unknown>}[]){
 return sales.some(s=>s.pricing?.status==='review')||settlements.some(s=>s.kind==='fee'&&Object.entries(s.raw||{}).some(([k,v])=>/transaction.*description|amount.*type/i.test(k)&&/walmart[\s_-]*funded/i.test(String(v))));
}
