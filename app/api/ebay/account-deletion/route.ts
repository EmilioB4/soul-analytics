import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/tiktok';
import {deletionConfig,deletionChallenge,verifiedDeletion,InvalidNotification} from '../../../../lib/ebay-deletion';
export const runtime='nodejs';export const maxDuration=60;export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:NextRequest){
 const values=req.nextUrl.searchParams.getAll('challenge_code');
 if(values.length!==1||!values[0]||values[0].length>2048)return json({error:'A challenge code is required.'},400);
 try{return json({challengeResponse:deletionChallenge(values[0])});}catch{return json({error:'Deletion endpoint setup is incomplete.'},503);}
}
export async function POST(req:NextRequest){
 try{deletionConfig();}catch{return json({error:'Deletion endpoint setup is incomplete.'},503);}
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Expected JSON.'},415);
 if(!req.headers.get('x-ebay-signature'))return json({error:'A valid eBay signature is required.'},412);
 let raw:string;
 try{
  const reader=req.body?.getReader();if(!reader)return json({error:'Missing notification.'},400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();return json({error:'Notification too large.'},413);}chunks.push(part.value);}
  raw=Buffer.concat(chunks).toString('utf8');
 }catch{return json({error:'Invalid notification body.'},400);}
 try{
  const account=await verifiedDeletion(raw,req.headers.get('x-ebay-signature'));
  const result=await db().rpc('delete_ebay_account_data',{p_account:account});
  if(result.error)throw Error('Deletion failed.');
  return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }catch(error){return json({error:error instanceof InvalidNotification?'Invalid eBay notification.':'Notification could not be processed; retry delivery.'},error instanceof InvalidNotification?412:503);}
}
