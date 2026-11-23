import {saleImage} from './walmart-sale-message';
function entities(value:string){return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi,token=>{const named:Record<string,string>={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[token.toLowerCase()])return named[token.toLowerCase()];const hex=/^&#x/i.test(token),n=parseInt(token.slice(hex?3:2,-1),hex?16:10);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
function productUrl(value:string,itemId:string){try{const url=new URL(value,'https://www.walmart.com');const match=url.pathname.match(/^\/ip\/(?:[^/]+\/)?(\d+)\/?$/);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['www.walmart.com','walmart.com'].includes(url.hostname)&&match?.[1]===itemId?url:null;}catch{return null;}}
export function pagePrimaryImage(html:string,itemId:string){
 if(!/^\d{1,30}$/.test(itemId)||Buffer.byteLength(html)>2*1024*1024)return null;
 const end=html.toLowerCase().indexOf('</head>');if(end<0)return null;
 const head=html.slice(0,end).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
 const identities:string[]=[],images:string[]=[];
 for(const tag of head.match(/<(?:meta|link)\b[^>]*>/gi)||[]){const attributes:Record<string,string>={};for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attributes[match[1].toLowerCase()]=entities(match[2]??match[3]);
  if(attributes.property?.toLowerCase()==='og:image'&&attributes.content)images.push(attributes.content);
  if(attributes.property?.toLowerCase()==='og:url'&&attributes.content)identities.push(attributes.content);
  if(attributes.rel?.toLowerCase()==='canonical'&&attributes.href)identities.push(attributes.href);
 }
 if(!identities.length||identities.some(url=>!productUrl(url,itemId)))return null;
 return images.map(saleImage).find(Boolean)||null;
}
export async function fetchWalmartPrimaryImage(itemId:string,timeoutMs=3000):Promise<string|null>{
 if(!/^\d{1,30}$/.test(itemId))return null;
 let url='https://www.walmart.com/ip/'+itemId;const deadline=Date.now()+timeoutMs;
 try{
  for(let i=0;i<3;i++){
   const remaining=deadline-Date.now();if(remaining<=0)return null;
   const response=await fetch(url,{headers:{Accept:'text/html'},credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(remaining)});
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');const next=location?productUrl(new URL(location,url).toString(),itemId):null;await response.body?.cancel();if(!next)return null;url=next.toString();continue;}
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();return null;}
   const reader=response.body?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();return null;}chunks.push(part.value);}
   return pagePrimaryImage(Buffer.concat(chunks).toString('utf8'),itemId);
  }
 }catch{/* A missing/blocked page must not block delivery or trigger scraping workarounds. */}
 return null;
}
