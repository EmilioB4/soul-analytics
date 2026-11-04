import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid,decryptPlaidToken} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function DELETE(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const database=db();const {data:connection,error}=await database.from('plaid_connections').select('access_token_encrypted').eq('owner_id',user.id).maybeSingle();if(error)throw error;
 if(!connection)return NextResponse.json({disconnected:true});
 await plaid('/item/remove',{access_token:decryptPlaidToken(connection.access_token_encrypted)});
 const {error:deleteError}=await database.from('plaid_connections').delete().eq('owner_id',user.id);if(deleteError)throw deleteError;
 // Transaction history is intentionally deleted when bank access is removed.
 const {error:txError}=await database.from('plaid_bank_transactions').delete().eq('owner_id',user.id);if(txError)throw txError;
 return NextResponse.json({disconnected:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not disconnect bank'},{status:503});}
}
