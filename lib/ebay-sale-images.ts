import {XMLParser,XMLValidator} from 'fast-xml-parser';
export function ebayImageUrl(value:unknown){if(typeof value!=='string')return null;try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!['ebayimg.com','ebaystatic.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;u.protocol='https:';return u.toString();}catch{return null;}}
export function parseSaleImage(xml:string,id:string){
 if(!/^\d{1,30}$/.test(id)||Buffer.byteLength(xml)>128*1024||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)return null;
 const root=new XMLParser({ignoreAttributes:false,parseTagValue:false,removeNSPrefix:true}).parse(xml)?.GetItemResponse;
 if(!['Success','Warning'].includes(root?.Ack)||root.Item?.ItemID!==id)return null;
 const pictures=root.Item?.PictureDetails,urls=pictures?.PictureURL;
 return [pictures?.GalleryURL,...(Array.isArray(urls)?urls:urls?[urls]:[])].map(ebayImageUrl).find(Boolean)||null;
}
export async function fetchSaleImage(id:string,token:string,timeout=5000){
 if(!/^\d{1,30}$/.test(id))return null;
 try{
  const response=await fetch('https://api.ebay.com/ws/api.dll',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','X-EBAY-API-CALL-NAME':'GetItem','X-EBAY-API-SITEID':'0','X-EBAY-API-COMPATIBILITY-LEVEL':'1489','X-EBAY-API-IAF-TOKEN':token},body:`<?xml version="1.0" encoding="utf-8"?><GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ItemID>${id}</ItemID><OutputSelector>Item.ItemID</OutputSelector><OutputSelector>Item.PictureDetails</OutputSelector><OutputSelector>Ack</OutputSelector></GetItemRequest>`,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeout)});
  if(!response.ok){await response.body?.cancel();return null;}
  const reader=response.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;
  while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>128*1024){await reader.cancel();return null;}chunks.push(next.value);}
  return parseSaleImage(Buffer.concat(chunks).toString('utf8'),id);
 }catch{return null;}
}
