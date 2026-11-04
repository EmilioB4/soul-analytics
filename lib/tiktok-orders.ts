import {createHmac,createDecipheriv} from 'node:crypto';
import {db,encrypt} from './tiktok';

const BASE='https://open-api.tiktokglobalshop.com';
type Connection={owner_id:string;access_token_encrypted:string;refresh_token_encrypted:string;access_expires_at:string|null;refresh_expires_at:string|null};
export function decrypt(value:string){
 const key=Buffer.from(process.env.TIKTOK_TOKEN_ENCRYPTION_KEY||'','hex');
 if(key.length!==32)throw Error('Encryption key is not configured');
 const bytes=Buffer.from(value,'base64');
 if(bytes.length<29)throw Error('Stored token is invalid');
 const d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
 d.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8');
}
function required(name:string){const val=process.env[name];if(!val)throw Error(`Missing ${name}`);return val;}
export async function accessToken(connection:Connection){
 const expiry=connection.access_expires_at?Date.parse(connection.access_expires_at):0;
 if(expiry && expiry>Date.now()+10*60*1000)return decrypt(connection.access_token_encrypted);
 // Refresh if expiration is absent or approaching. Refresh-token rotation is persisted.
 const url=new URL('https://auth.tiktok-shops.com/api/v2/token/refresh');
 url.searchParams.set('app_key',required('TIKTOK_SHOP_APP_KEY'));
 url.searchParams.set('app_secret',required('TIKTOK_SHOP_APP_SECRET'));
 url.searchParams.set('refresh_token',decrypt(connection.refresh_token_encrypted));
 url.searchParams.set('grant_type','refresh_token');
 const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 const j=await r.json();
 if(!r.ok||j.code!==0||!j.data?.access_token||!j.data?.refresh_token)throw Error('TikTok token refresh failed. Reauthorize the shop if necessary.');
 const d=j.data;
 const parseExpiry=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString():null};
 const {error}=await db().from('tiktok_connections').update({access_token_encrypted:encrypt(d.access_token),refresh_token_encrypted:encrypt(d.refresh_token),access_expires_at:parseExpiry(d.access_token_expire_in),refresh_expires_at:parseExpiry(d.refresh_token_expire_in),updated_at:new Date().toISOString()}).eq('owner_id',connection.owner_id);
 if(error)throw Error('Could not save refreshed TikTok credentials');
 return String(d.access_token);
}
export function signature(path:string,params:Record<string,string>,body=''){
 const secret=required('TIKTOK_SHOP_APP_SECRET');
 const pairs=Object.entries(params).filter(([k])=>k!=='sign'&&k!=='access_token').sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+v).join('');
 const input=secret+path+pairs+body+secret;
 return createHmac('sha256',secret).update(input).digest('hex');
}
export async function tikTokCall(path:string,token:string,body?:Record<string,unknown>,other:Record<string,string>={}){
 const params:Record<string,string>={app_key:required('TIKTOK_SHOP_APP_KEY'),timestamp:String(Math.floor(Date.now()/1000)),...other};
 const encoded=body===undefined?'':JSON.stringify(body);
 const url=new URL(BASE+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 url.searchParams.set('sign',signature(path,params,encoded));
 const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-tts-access-token':token},body:body===undefined?undefined:encoded,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
 const json=await response.json();
 if(!response.ok||json.code!==0)throw Error(`TikTok API error ${String(json.code??response.status)}: ${String(json.message||'Unknown error').slice(0,180)}`);
 return json.data;
}
export type TikTokOrder={id:string;status?:string;create_time?:number;update_time?:number;payment?:{currency?:string;sub_total?:string;total_amount?:string}};
export function orderRow(o:TikTokOrder,ownerId:string,shopId:string){
 const money=(v:unknown)=>{if(v===undefined||v===null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
 const time=(v:unknown)=>{const n=Number(v);return n>0&&Number.isFinite(n)?new Date(n*1000).toISOString():null};
 return {owner_id:ownerId,shop_id:shopId,order_id:String(o.id),status:String(o.status||'UNKNOWN'),created_at:time(o.create_time),updated_at:time(o.update_time),currency:String(o.payment?.currency||'USD'),product_subtotal:money(o.payment?.sub_total),buyer_paid_total:money(o.payment?.total_amount),synced_at:new Date().toISOString()};
}
