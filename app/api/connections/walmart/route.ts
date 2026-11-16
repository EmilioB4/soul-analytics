import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {owner,db,encrypt} from '../../../../lib/tiktok';
import {hasWalmartConnection,legacyWalmartOwner,validateWalmartCredentials} from '../../../../lib/walmart-connections';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const personal=await hasWalmartConnection(user.id),legacy=await legacyWalmartOwner(user.id)&&Boolean(process.env.WALMART_CLIENT_ID&&process.env.WALMART_CLIENT_SECRET);
 return NextResponse.json({connected:personal||legacy,personal,legacy:!personal&&legacy});
}catch{return NextResponse.json({error:'Could not load Walmart connection.'},{status:503});}}
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json();const id=typeof body.clientId==='string'?body.clientId.trim():'',secret=typeof body.clientSecret==='string'?body.clientSecret.trim():'';
 if(!id||!secret||id.length>1000||secret.length>2000)return NextResponse.json({error:'Enter your Walmart Client ID and Client Secret.'},{status:400});
 const legacyOwner=await legacyWalmartOwner(user.id);
 if(process.env.WALMART_CLIENT_ID===id&&!legacyOwner)return NextResponse.json({error:'These credentials belong to the existing workspace connection.'},{status:409});
 const client=db(),fingerprint=createHash('sha256').update(id).digest('hex');
 const existing=await client.from('walmart_connections').select('client_fingerprint').eq('owner_id',user.id).maybeSingle();
 if(existing.error)return NextResponse.json({error:'Run supabase/multiuser_foundation.sql before connecting Walmart.'},{status:503});
 // Keep historical orders, inventory and fees tied to the same connection. Key rotation
 // with a new client ID needs an explicit migration, not silent account replacement.
 if(existing.data&&existing.data.client_fingerprint!==fingerprint)return NextResponse.json({error:'Changing the connected Walmart Client ID is not supported yet. This protects your existing dashboard history.'},{status:409});
 if(legacyOwner&&process.env.WALMART_CLIENT_ID&&id!==process.env.WALMART_CLIENT_ID)return NextResponse.json({error:'Use the Client ID of your existing Walmart connection to preserve dashboard history.'},{status:409});
 await validateWalmartCredentials(id,secret);
 const {error}=await client.from('walmart_connections').upsert({owner_id:user.id,client_fingerprint:fingerprint,client_id_encrypted:encrypt(id),client_secret_encrypted:encrypt(secret),updated_at:new Date().toISOString()},{onConflict:'owner_id'});
 if(error)return NextResponse.json({error:error.code==='23505'?'These credentials are already linked to an account.':'Could not securely save the Walmart connection.'},{status:error.code==='23505'?409:503});
 return NextResponse.json({connected:true});
}catch{return NextResponse.json({error:'Could not connect Walmart. Check credentials, API permissions, and server encryption setup.'},{status:502});}}
