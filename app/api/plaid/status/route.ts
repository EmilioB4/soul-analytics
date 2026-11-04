import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid,decryptPlaidToken,accountOptions,likelyTikTok} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const database=db();const {data:connection,error}=await database.from('plaid_connections').select('item_id,access_token_encrypted,account_id,account_name,account_mask,cursor,updated_at').eq('owner_id',user.id).maybeSingle();if(error)throw Error('Run supabase/plaid_bank.sql first');
 if(!connection)return NextResponse.json({connected:false});
 let accounts:ReturnType<typeof accountOptions>=[];
 if(!connection.account_id){const result=await plaid('/accounts/get',{access_token:decryptPlaidToken(connection.access_token_encrypted)});accounts=accountOptions(result.accounts||[]);}
 const {data:transactions,error:txError}=await database.from('plaid_bank_transactions').select('transaction_id,date,name,amount,pending,currency').eq('owner_id',user.id).order('date',{ascending:false}).limit(500);if(txError)throw txError;
 const candidates=(transactions||[]).filter(t=>!t.pending&&Number(t.amount)>0&&t.currency==='USD'&&likelyTikTok(t.name));
 return NextResponse.json({connected:true,account:connection.account_id?{name:connection.account_name,mask:connection.account_mask}:null,accounts,lastSync:connection.updated_at,transactionCount:(transactions||[]).length,candidateCount:candidates.length,candidateTotal:Math.round(candidates.reduce((sum,t)=>sum+Number(t.amount),0)*100)/100,candidates:candidates.slice(0,30).map(t=>({id:t.transaction_id,date:t.date,name:t.name,amount:Number(t.amount)})),disclaimer:'Potential TikTok deposits identified by description, not confirmed matches to settlements.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load bank status'},{status:503});}
}
