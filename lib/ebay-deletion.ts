import {createHash,createPublicKey,verify} from 'node:crypto';

export function deletionConfig(){
 const token=process.env.EBAY_DELETION_VERIFICATION_TOKEN||'';
 if(!/^[A-Za-z0-9_-]{32,80}$/.test(token))throw Error('Deletion verification token is not configured.');
 const origin=new URL(process.env.EBAY_APP_URL||'');
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.port)throw Error('Invalid eBay application origin.');
 return {token,endpoint:origin.origin+'/api/ebay/account-deletion'};
}
export function deletionChallenge(challenge:string){
 const {token,endpoint}=deletionConfig();
 return createHash('sha256').update(challenge).update(token).update(endpoint).digest('hex');
}
export class InvalidNotification extends Error {}
const keys=new Map<string,{key:string;until:number}>();
let appToken:{value:string;until:number}|undefined;
async function publicKey(kid:string){
 const cached=keys.get(kid);if(cached&&cached.until>Date.now())return cached.key;
 const clientId=process.env.EBAY_CLIENT_ID,secret=process.env.EBAY_CLIENT_SECRET;
 if(!clientId||!secret)throw Error('Missing eBay app credentials.');
 if(!appToken||appToken.until<=Date.now()){
  const response=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(clientId+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('eBay application authorization unavailable.');
  const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Invalid application authorization.');
  appToken={value:data.access_token,until:Date.now()+Math.max(0,data.expires_in-60)*1000};
 }
 const response=await fetch('https://api.ebay.com/commerce/notification/v1/public_key/'+encodeURIComponent(kid),{headers:{Authorization:'Bearer '+appToken.value,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('eBay signature key unavailable.');
 const data=await response.json();
 if(typeof data.key!=='string'||data.key.length>10000)throw Error('Invalid signature key.');
 const key=data.key.replace(/-----BEGIN PUBLIC KEY-----\s*/, '-----BEGIN PUBLIC KEY-----\n').replace(/\s*-----END PUBLIC KEY-----/, '\n-----END PUBLIC KEY-----');
 const parsed=createPublicKey(key);if(parsed.asymmetricKeyType!=='ec')throw Error('Invalid signature key type.');
 if(keys.size>=100)keys.delete(keys.keys().next().value!);
 keys.set(kid,{key,until:Date.now()+3600000});return key;
}
function decodeBase64(value:unknown){
 if(typeof value!=='string'||!value||value.length>12000||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new InvalidNotification('Invalid signature.');
 return Buffer.from(value,'base64');
}
export async function verifiedDeletion(raw:string,header:string|null){
 let signature:any,payload:any;
 try{
  signature=JSON.parse(decodeBase64(header).toString('utf8'));payload=JSON.parse(raw);
  if(typeof signature.kid!=='string'||!signature.kid||signature.kid.length>256)throw Error();
 }catch{throw new InvalidNotification('Invalid notification.');}
 const bytes=decodeBase64(signature.signature),key=await publicKey(signature.kid);
 // eBay's official Node SDK signs JSON.stringify(message) using ECDSA/SHA-1.
 if(!verify('sha1',Buffer.from(JSON.stringify(payload)),key,bytes))throw new InvalidNotification('Invalid signature.');
 const notification=payload?.notification,account=notification?.data?.userId;
 if(payload?.metadata?.topic!=='MARKETPLACE_ACCOUNT_DELETION'||payload?.metadata?.schemaVersion!=='1.0'||typeof account!=='string'||!account.trim()||account.length>512||typeof notification.notificationId!=='string'||!notification.notificationId||notification.notificationId.length>512)throw new InvalidNotification('Invalid deletion payload.');
 return account as string;
}
