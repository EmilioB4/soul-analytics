import {db} from './tiktok';
import {decrypt} from './tiktok-orders';
// An absent migration may fall back only to the explicitly bound legacy owner.
async function connection(ownerId:string){
 const {data,error}=await db().from('walmart_connections').select('client_id_encrypted,client_secret_encrypted').eq('owner_id',ownerId).maybeSingle();
 if(error&&error.code!=='PGRST205'&&error.code!=='42P01')throw Error('Could not read your Walmart connection. Retry later.');
 return data;
}
export async function hasWalmartConnection(ownerId:string){return Boolean(await connection(ownerId));}
export async function legacyWalmartOwner(ownerId:string){
 if(process.env.WALMART_OWNER_ID)return process.env.WALMART_OWNER_ID===ownerId;
 const {data,error}=await db().from('payout_platform_owners').select('owner_id').eq('platform','walmart').maybeSingle();
 return !error&&data?.owner_id===ownerId;
}
export async function walmartCredentials(ownerId:string):Promise<{id:string;secret:string}>{
 if(!ownerId)throw Error('A signed-in account is required for Walmart.');
 const saved=await connection(ownerId);
 if(saved)return {id:decrypt(saved.client_id_encrypted),secret:decrypt(saved.client_secret_encrypted)};
 if(await legacyWalmartOwner(ownerId)){
  const id=process.env.WALMART_CLIENT_ID,secret=process.env.WALMART_CLIENT_SECRET;
  if(id&&secret)return {id,secret};
 }
 throw Error('Connect your own Walmart account in Connections & settings.');
}
export async function validateWalmartCredentials(id:string,secret:string){
 const response=await fetch('https://marketplace.walmartapis.com/v3/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${id}:${secret}`).toString('base64'),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded','WM_SVC.NAME':'Walmart Marketplace','WM_QOS.CORRELATION_ID':crypto.randomUUID()},body:'grant_type=client_credentials',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!(data?.access_token||data?.clientCredentialsRes?.value?.access_token))throw Error('Walmart could not verify these credentials. Check the key and its API permissions.');
}
