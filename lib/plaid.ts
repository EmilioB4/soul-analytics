import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

const HOSTS:Record<string,string>={production:'https://production.plaid.com',sandbox:'https://sandbox.plaid.com'};
export async function plaid(path:string,body:Record<string,unknown>):Promise<any>{
 const env=process.env.PLAID_ENV||'sandbox';const base=HOSTS[env];
 if(!base)throw Error('Invalid PLAID_ENV');
 const client_id=process.env.PLAID_CLIENT_ID,secret=process.env.PLAID_SECRET;
 if(!client_id||!secret)throw Error('Plaid credentials are not configured');
 const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,client_id,secret}),cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(`Plaid ${result.error_code||response.status}: ${String(result.error_message||'Request failed').slice(0,180)}`);
 return result;
}
function key(){const bytes=Buffer.from(process.env.PLAID_TOKEN_ENCRYPTION_KEY||'','hex');if(bytes.length!==32)throw Error('Set a 64-character PLAID_TOKEN_ENCRYPTION_KEY');return bytes;}
export function encryptPlaidToken(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');}
export function decryptPlaidToken(value:string){const data=Buffer.from(value,'base64');if(data.length<29)throw Error('Invalid encrypted token');const decipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');}
export function accountOptions(accounts:any[]){return accounts.filter(a=>a.type==='depository'&&a.subtype==='checking').map(a=>({id:String(a.account_id),name:String(a.name||'Checking'),mask:String(a.mask||''),subtype:String(a.subtype)}));}
export function likelyTikTok(name:string){return /(?:tiktok|tik\s?tok|byte\s?dance|pipo)/i.test(name);}
