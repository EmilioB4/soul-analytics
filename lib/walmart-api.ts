export async function walmartAccessToken(){
 const id=process.env.WALMART_CLIENT_ID,secret=process.env.WALMART_CLIENT_SECRET;
 if(!id||!secret)throw Error('Missing WALMART_CLIENT_ID or WALMART_CLIENT_SECRET in Vercel.');
 const response=await fetch('https://marketplace.walmartapis.com/v3/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID()},body:'grant_type=client_credentials',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await response.json();
 if(!response.ok)throw Error(`Walmart authentication HTTP ${response.status}.`);
 const token=data.access_token||data.clientCredentialsRes?.value?.access_token;
 if(!token)throw Error('Walmart returned no access token.');
 return String(token);
}
export async function walmartReport(path:string,token:string,service='settlement reports'){
 const url=new URL(path,'https://marketplace.walmartapis.com');
 if(url.origin!=='https://marketplace.walmartapis.com')throw Error('Invalid Walmart report URL.');
 const response=await fetch(url,{headers:{'WM_SEC.ACCESS_TOKEN':token,'WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID(),Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok){
  let detail='';try{const data=await response.json();const entries=Array.isArray(data.errors)?data.errors:Array.isArray(data.error)?data.error:[];detail=entries.slice(0,3).map((entry:Record<string,unknown>)=>[entry.code,entry.field,entry.parameter,entry.description].filter(v=>typeof v==='string').join(': ')).join('; ').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,400);}catch{}
  const reason=response.status===400?'Walmart rejected the request parameters.':response.status===403?`Enable ${service==='WFS inventory'?'WFS Inventory':service==='listing prices'?'Items':service==='customer returns'?'Returns':'Reports'} access for this Walmart API key.`:response.status===429?'Walmart rate limit reached; retry later.':'The Walmart request failed; retry or check service availability.';
  throw Error(`Walmart ${service} HTTP ${response.status}. ${reason}${detail?' '+detail:''}`);
 }
 return response.json();
}
