export const EBAY_FEE_SOURCE='https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822';
export type EbayFeeInputs={price:number;buyerShipping:number;buyerTax:number;cost:number;label:number;packaging:number;rate:number;threshold:number;excessRate:number;adRate:number;extraRate:number;insertion:number;feeTax:number;other:number;orderFee:number|null};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// One item, one domestic USD order. The tax-inclusive fee base is not seller revenue.
export function calculateEbayFees(i:EbayFeeInputs){
 for(const [key,value] of Object.entries(i)){if(key==='orderFee'&&value===null)continue;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e7)throw Error('Enter valid, non-negative amounts.');}
 if(i.price<=0||[i.rate,i.excessRate,i.adRate,i.extraRate].some(n=>n>100))throw Error('Enter a sale price and percentage rates between 0 and 100.');
 const revenue=round(i.price+i.buyerShipping),feeBase=round(revenue+i.buyerTax);
 const finalValue=round(Math.min(feeBase,i.threshold)*i.rate/100+Math.max(0,feeBase-i.threshold)*i.excessRate/100),orderFee=i.orderFee??(feeBase<=10?.3:.4),ads=round(feeBase*i.adRate/100),extra=round(feeBase*i.extraRate/100);
 const sellingFees=round(finalValue+orderFee+ads+extra+i.insertion+i.feeTax),expenses=round(sellingFees+i.label+i.packaging+i.other),receive=round(revenue-expenses),profit=round(receive-i.cost);
 return {revenue,feeBase,finalValue,orderFee,ads,extra,sellingFees,expenses,receive,profit,roi:i.cost?profit/i.cost*100:null,margin:profit/revenue*100,breakEvenBuy:receive};
}
