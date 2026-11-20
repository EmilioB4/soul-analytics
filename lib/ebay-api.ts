import {db,encrypt} from './tiktok';
import {decrypt} from './tiktok-orders';
import {ebayConfig,ebayScopes} from './ebay-config';
export async function ebayTokenRequest(parameters:Record<string,string>){
 const {clientId,clientSecret}=ebayConfig();
 const response=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(parameters),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('eBay authorization failed. Reconnect your account or verify application settings.');
 const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token.trim()||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Invalid eBay authorization response.');if(data.refresh_token!==undefined&&(typeof data.refresh_token!=='string'||!data.refresh_token.trim()))throw Error('Invalid eBay refresh token response.');
 if(data.refresh_token_expires_in!==undefined&&(!Number.isFinite(data.refresh_token_expires_in)||data.refresh_token_expires_in<=0))throw Error('Invalid eBay refresh expiry response.');
 return data;
}
export async function ebayGet(path:string,token:string,timeout=12000){
 const url=new URL(path,'https://api.ebay.com');
 if(!['https://api.ebay.com','https://apiz.ebay.com'].includes(url.origin)||url.username||url.password||url.hash)throw Error('Invalid eBay API origin.');
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json','X-EBAY-C-MARKETPLACE-ID':'EBAY_US'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error(response.status===401?'eBay authorization expired. Reconnect your account.':response.status===403?'eBay denied access. Reconnect and approve the requested permissions.':response.status===429?'eBay rate limit reached. Try again later.':'eBay request failed (HTTP '+response.status+').');
 if(response.status===204)return {transactions:[],total:0};
 return response.json();
}
export async function ebayAccessToken(ownerId:string){
 const client=db();const selected=await client.from('ebay_connections').select('*').eq('owner_id',ownerId).single();if(selected.error||!selected.data)throw Error('Connect your eBay account first.');const connection=selected.data;
 if(Date.parse(connection.access_expires_at)>Date.now()+120000)return {token:decrypt(connection.access_token_encrypted),accountId:connection.account_id};
 if(!Number.isFinite(Date.parse(connection.refresh_expires_at))||Date.parse(connection.refresh_expires_at)<=Date.now())throw Error('eBay authorization expired. Reconnect your account.');
 const lease=crypto.randomUUID(),claim=await client.rpc('claim_ebay_refresh',{p_owner:ownerId,p_version:connection.version,p_token:lease});if(claim.error||!claim.data)throw Error('eBay authorization refresh is already running. Try again shortly.');
 try{
  const data=await ebayTokenRequest({grant_type:'refresh_token',refresh_token:decrypt(connection.refresh_token_encrypted),scope:ebayScopes.join(' ')});
  const saved=await client.from('ebay_connections').update({access_token_encrypted:encrypt(data.access_token),access_expires_at:new Date(Date.now()+data.expires_in*1000).toISOString(),...(typeof data.refresh_token==='string'?{refresh_token_encrypted:encrypt(data.refresh_token),...(data.refresh_token_expires_in!==undefined?{refresh_expires_at:new Date(Date.now()+data.refresh_token_expires_in*1000).toISOString()}:{})}:{})}).eq('owner_id',ownerId).eq('version',connection.version).eq('refresh_lock',lease).select('owner_id');
  if(saved.error||saved.data?.length!==1)throw Error('eBay connection changed; retry the request.');return {token:data.access_token as string,accountId:connection.account_id as string};
 }finally{await client.from('ebay_connections').update({refresh_lock:null,refresh_locked_until:null}).eq('owner_id',ownerId).eq('refresh_lock',lease);}
}
