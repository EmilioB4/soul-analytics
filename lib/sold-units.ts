// Unknown quantities stay unknown; an order/ledger row is not assumed to be one unit.
export function soldQuantity(value:unknown):number|null{
 if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
}
