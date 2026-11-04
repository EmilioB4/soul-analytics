import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid,decryptPlaidToken,accountOptions} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {accountId}=await req.json();if(typeof accountId!=='string'||accountId.length>200)return NextResponse.json({error:'Invalid account'},{status:400});
 const database=db();const {data:connection,error}=await database.from('plaid_connections').select('access_token_encrypted,account_id').eq('owner_id',user.id).single();if(error||!connection)return NextResponse.json({error:'Connect your bank first'},{status:404});
 if(connection.account_id)return NextResponse.json({error:'Bank account already selected. Contact support to change it safely.'},{status:409});
 const result=await plaid('/accounts/get',{access_token:decryptPlaidToken(connection.access_token_encrypted)});const chosen=accountOptions(result.accounts||[]).find(x=>x.id===accountId);if(!chosen)return NextResponse.json({error:'Choose a checking account provided by Plaid'},{status:400});
 const {error:saveError}=await database.from('plaid_connections').update({account_id:chosen.id,account_name:chosen.name,account_mask:chosen.mask,updated_at:new Date().toISOString()}).eq('owner_id',user.id).is('account_id',null);if(saveError)throw saveError;
 return NextResponse.json({selected:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not select bank account'},{status:503});}
}
