import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid,encryptPlaidToken,accountOptions} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {publicToken}=await req.json();if(typeof publicToken!=='string'||publicToken.length>2000||!publicToken.startsWith('public-'))return NextResponse.json({error:'Invalid Plaid Link token'},{status:400});
 const database=db();const {data:existing,error:lookupError}=await database.from('plaid_connections').select('item_id').eq('owner_id',user.id).maybeSingle();if(lookupError)throw lookupError;
 if(existing)return NextResponse.json({error:'A bank is already connected'},{status:409});
 const exchanged=await plaid('/item/public_token/exchange',{public_token:publicToken});
 const accessToken=String(exchanged.access_token),itemId=String(exchanged.item_id);
 try{
 const accounts=await plaid('/accounts/get',{access_token:accessToken});const options=accountOptions(accounts.accounts||[]);
 const selected=options.length===1?options[0]:null;
 const {error}=await database.from('plaid_connections').insert({owner_id:user.id,item_id:itemId,access_token_encrypted:encryptPlaidToken(accessToken),account_id:selected?.id||null,account_name:selected?.name||null,account_mask:selected?.mask||null,updated_at:new Date().toISOString()});if(error)throw error;
 return NextResponse.json({connected:true,needsAccountSelection:!selected});
 }catch(e){await plaid('/item/remove',{access_token:accessToken}).catch(()=>{});throw e;}
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bank connection failed'},{status:503});}
}
