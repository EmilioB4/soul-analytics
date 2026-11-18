import {db} from './tiktok';
import {decrypt} from './tiktok-orders';
export function legacyWhatnotOwner(ownerId:string){return Boolean(ownerId&&process.env.WHATNOT_OWNER_ID===ownerId&&process.env.WHATNOT_API_TOKEN?.trim());}
export async function whatnotConnection(ownerId:string){
 const result=await db().from('whatnot_connections').select('seller_id,username,token_encrypted,updated_at').eq('owner_id',ownerId).maybeSingle();
 if(result.error&&!['PGRST205','42P01'].includes(result.error.code))throw Error('Could not read your Whatnot connection.');
 return {saved:result.data,setupRequired:Boolean(result.error)};
}
export async function hasWhatnotConnection(ownerId:string){const {saved}=await whatnotConnection(ownerId);return saved?Boolean(saved.token_encrypted):legacyWhatnotOwner(ownerId);}
export async function whatnotToken(ownerId:string){
 if(!ownerId)throw Error('Sign in to connect Whatnot.');
 const {saved}=await whatnotConnection(ownerId);
 if(saved){if(!saved.token_encrypted)throw Error('Reconnect Whatnot in Integrations.');return decrypt(saved.token_encrypted);}
 if(legacyWhatnotOwner(ownerId))return process.env.WHATNOT_API_TOKEN!.trim();
 throw Error('Connect your own Whatnot account in Integrations first.');
}
export async function verifyWhatnotToken(token:string){
 const response=await fetch('https://api.whatnot.com/seller-api/rest/v2/users/me',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error(response.status===401||response.status===403?'Whatnot could not verify this token. Check its expiration and permissions.':'Whatnot verification is temporarily unavailable.');
 const user=await response.json();if(typeof user.id!=='string'||!user.id||typeof user.username!=='string')throw Error('Unrecognized Whatnot seller identity.');return {id:user.id,username:user.username};
}
