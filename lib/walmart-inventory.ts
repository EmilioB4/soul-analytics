export const inventoryColumns=['id','sku','name','status','stage','buy_date','store','qty','unit_price','discount_pct','cashback_pct','shipping','unit_cost','order_no','payment','event','condition','location','wfs_shipment','wm_sku','plan','target_price','target_date','tags','sold','left','realized','days_to_sell','value_now','wfs_price','wfs_src','wfs_net','profit_unit','unrealized','total_profit','notes'] as const;
export type InventoryColumn=typeof inventoryColumns[number];
export type InventoryLot=Record<InventoryColumn,string>;
const numericColumns=['qty','unit_price','discount_pct','cashback_pct','shipping','unit_cost','target_price','sold','left','realized','days_to_sell','value_now','wfs_price','wfs_net','profit_unit','unrealized','total_profit'];
const nonnegative=['qty','unit_price','discount_pct','cashback_pct','shipping','unit_cost','target_price','sold','left','days_to_sell','value_now','wfs_price'];
export function parseInventoryCsv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else if(quoted){quoted=false;closed=true;}
   else if(field===''&&!closed)quoted=true;
   else throw Error(`Unexpected quote near CSV row ${rows.length+1}.`);
  }else if(c===','&&!quoted){row.push(field);field='';closed=false;}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false;}
  else{if(closed&&!quoted&&!/\s/.test(c))throw Error(`Unexpected text after quote near CSV row ${rows.length+1}.`);if(!closed||quoted)field+=c;}
 }
 if(quoted)throw Error('CSV has an unclosed quoted field.');
 row.push(field);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function validateInventoryLot(input:unknown,label='Lot'):InventoryLot{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error(`${label}: invalid lot.`);
 const record=input as Record<string,unknown>;
 const out=Object.fromEntries(inventoryColumns.map(c=>{const value=record[c];if(value!=null&&typeof value!=='string'&&typeof value!=='number')throw Error(`${label}: invalid ${c}.`);return [c,String(value??'').trim()];})) as InventoryLot;
 for(const c of ['id','sku','name','stage','qty','sold','left'])if(!out[c as InventoryColumn])throw Error(`${label}: ${c} is required.`);
 if(out.id.length>120||out.sku.length>120||out.name.length>500)throw Error(`${label}: ID, SKU or name is too long.`);
 for(const c of inventoryColumns)if(out[c].length>10000)throw Error(`${label}: ${c} exceeds 10,000 characters.`);
 for(const c of numericColumns){const key=c as InventoryColumn;if(!out[key])continue;const n=Number(out[key].replace(/[$,\s]/g,''));if(!Number.isFinite(n)||Math.abs(n)>1e9)throw Error(`${label}: ${c} must be a valid number.`);if(nonnegative.includes(c)&&n<0)throw Error(`${label}: ${c} cannot be negative.`);if(['qty','sold','left','days_to_sell'].includes(c)&&!Number.isInteger(n))throw Error(`${label}: ${c} must be a whole number.`);if(['discount_pct','cashback_pct'].includes(c)&&n>100)throw Error(`${label}: ${c} must be between 0 and 100.`);out[key]=String(n);}
 for(const c of ['buy_date','target_date'] as const){if(!out[c])continue;const d=new Date(out[c]);if(!/^\d{4}-\d{2}-\d{2}$/.test(out[c])||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==out[c])throw Error(`${label}: ${c} must use a valid YYYY-MM-DD date.`);}
 if(Number(out.sold)>Number(out.qty)||Number(out.left)!==Number(out.qty)-Number(out.sold))throw Error(`${label}: left must equal qty minus sold, and sold cannot exceed qty.`);
 return out;
}
export function importInventoryCsv(text:string){
 const rows=parseInventoryCsv(text);if(rows.length<2)throw Error('CSV has no inventory rows.');
 const headers=rows[0].map(c=>c.trim().toLowerCase());
 if(new Set(headers).size!==headers.length)throw Error('CSV contains duplicate column names.');
 const required=['id','sku','name','stage','qty','sold','left'];
 for(const c of required)if(!headers.includes(c))throw Error(`Missing column ${c}. Use the LEGO inventory CSV format.`);
 const unsupported=headers.filter(c=>!inventoryColumns.includes(c as InventoryColumn));if(unsupported.length)throw Error(`Unrecognized columns: ${unsupported.join(', ')}. Nothing was imported.`);
 if(rows.length>5001)throw Error('Import up to 5,000 purchase lots at a time.');
 const ids=new Set<string>();
 return rows.slice(1).map((values,i)=>{if(values.length!==headers.length)throw Error(`Row ${i+2}: column count does not match header.`);const lot=validateInventoryLot(Object.fromEntries(headers.map((c,index)=>[c,values[index]])),`Row ${i+2}`);if(ids.has(lot.id))throw Error(`Row ${i+2}: duplicate lot ID ${lot.id}.`);ids.add(lot.id);return lot;});
}
export function exportInventoryCsv(lots:InventoryLot[]){
 const quote=(v:string)=>/[",\r\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
 return [inventoryColumns.join(','),...lots.map(l=>inventoryColumns.map(c=>quote(l[c]??'')).join(','))].join('\r\n')+'\r\n';
}
export function inventorySummary(lots:InventoryLot[],threshold=5){
 const groups=new Map<string,{sku:string;name:string;lots:InventoryLot[];qty:number;sold:number;left:number;ordered:number;received:number;other:number;costValue:number;missingCost:number;resaleValue:number;missingResale:number}>();
 for(const lot of lots){const g=groups.get(lot.sku)||{sku:lot.sku,name:lot.name,lots:[],qty:0,sold:0,left:0,ordered:0,received:0,other:0,costValue:0,missingCost:0,resaleValue:0,missingResale:0};g.lots.push(lot);g.qty+=Number(lot.qty);g.sold+=Number(lot.sold);g.left+=Number(lot.left);if(lot.stage==='ordered')g.ordered+=Number(lot.left);else if(['received','at_wfs','listed'].includes(lot.stage))g.received+=Number(lot.left);else g.other+=Number(lot.left);if(lot.unit_cost!=='')g.costValue+=Number(lot.unit_cost)*Number(lot.left);else g.missingCost+=Number(lot.left);if(lot.value_now!=='')g.resaleValue+=Number(lot.value_now)*Number(lot.left);else g.missingResale+=Number(lot.left);groups.set(lot.sku,g);}
 const products=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
 const sum=(key:'qty'|'sold'|'left'|'ordered'|'received'|'other'|'costValue'|'missingCost'|'resaleValue'|'missingResale')=>products.reduce((n,p)=>n+p[key],0);
 return {products,qty:sum('qty'),sold:sum('sold'),left:sum('left'),ordered:sum('ordered'),received:sum('received'),other:sum('other'),costValue:sum('costValue'),missingCost:sum('missingCost'),resaleValue:sum('resaleValue'),missingResale:sum('missingResale'),lowStock:products.filter(p=>p.received>0&&p.received<=threshold).length};
}
