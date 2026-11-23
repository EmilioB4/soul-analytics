// US WFS public fee schedule, checked November 22, 2026. Posted charges take precedence.
export const WFS_FEE_SOURCE='https://marketplacelearn.walmart.com/guides/Walmart%20Fulfillment%20Services%20(WFS)/WFS%20basics/WFS-fees';
export type WfsInputs={price:number;cost:number;weight:number;length:number;width:number;height:number;referral:number;months:number;storageRate:number;inbound:number;inboundMode:'unit'|'pound'|'shipping-pound'|'shipment';shipmentUnits?:number;freeInbound?:boolean;prep:number;other:number;apparel:boolean;hazmat:boolean};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function calculateWfs(i:WfsInputs){
 for(const [key,value] of Object.entries(i))if(typeof value==='number'&&(!Number.isFinite(value)||value<0||value>1e7))throw Error('Enter valid, non-negative amounts.');
 if(i.price<=0||i.weight<=0||Math.min(i.length,i.width,i.height)<=0||i.referral>100)throw Error('Enter a sale price, weight and all three dimensions; referral must be 0–100%.');
 if(i.inboundMode==='shipment'&&(!Number.isSafeInteger(i.shipmentUnits)||Number(i.shipmentUnits)<=0))throw Error('Enter the total number of units in the shipment.');
 const [long,mid,short]=[i.length,i.width,i.height].sort((a,b)=>b-a),girth=long+2*(mid+short),volume=i.length*i.width*i.height/1728,dimensionalWeight=i.length*i.width*i.height/139;
 if(i.weight>500||long>120)throw Error('Outside this calculator’s WFS size limits. Confirm eligibility and fees with Walmart.');
 const bulky=i.weight>150||long>108||girth>165;
 const oversize=bulky?0:long>96||girth>130?2:long>48||mid>30||girth>105?1:0;
 const shippingWeight=bulky?Math.ceil(i.weight):Math.max(oversize===2?90:1,Math.ceil((i.weight<1?i.weight:Math.max(i.weight,dimensionalWeight))+.25));
 const w=shippingWeight;
 const base=bulky?155+.8*Math.max(0,w-90):w<=1?3.45:w===2?4.95:w===3?5.45:w<=20?5.75+.4*(w-4):w<=30?15.55+.4*(w-21):w<=50?14.55+.4*(w-31):17.55+.4*(w-51);
 const surcharge=bulky?0:(oversize===2?20:oversize===1?3:0)+(i.apparel?.5:0)+(i.hazmat?.5:0)+(i.price<10?1:0);
 const referral=cents(i.price*i.referral/100),fulfillment=cents(base+surcharge),storage=cents(volume*i.storageRate*i.months),inbound=cents(i.inbound*(i.inboundMode==='shipping-pound'?shippingWeight:i.inboundMode==='pound'?i.weight:i.inboundMode==='shipment'?1/Number(i.shipmentUnits):1));
 const fees=cents(referral+fulfillment+storage+inbound+i.prep+i.other),receive=cents(i.price-fees),profit=cents(receive-i.cost);
 const inboundMissing=i.inbound===0&&!i.freeInbound;
 return {inboundMissing,shippingWeight,dimensionalWeight,volume,bulky,oversize,referral,fulfillment,storage,inbound,fees,receive,profit,roi:i.cost?profit/i.cost*100:null,margin:profit/i.price*100,breakEvenBuy:receive};
}
