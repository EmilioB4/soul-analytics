import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid,decryptPlaidToken} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const database=db();const {data:connection,error}=await database.from('plaid_connections').select('access_token_encrypted,account_id,cursor').eq('owner_id',user.id).single();if(error||!connection)return NextResponse.json({error:'Bank not connected'},{status:404});
 if(!connection.account_id)return NextResponse.json({error:'Choose your Chase checking account first'},{status:400});
 const access=decryptPlaidToken(connection.access_token_encrypted);const initialCursor=connection.cursor||undefined;
 let added:any[]=[],modified:any[]=[],removed:any[]=[],finalCursor=initialCursor,complete=false;
 for(let attempt=0;attempt<2;attempt++){
  let cursor=initialCursor;added=[];modified=[];removed=[];complete=false;
  for(let page=0;page<30;page++){
   let response:any;
   try{response=await plaid('/transactions/sync',{access_token:access,cursor,count:500});}
   catch(e){if(e instanceof Error&&e.message.includes('TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION')&&attempt===0)break;throw e;}
   added.push(...(response.added||[]));modified.push(...(response.modified||[]));removed.push(...(response.removed||[]));cursor=response.next_cursor;
   if(!response.has_more){complete=true;finalCursor=cursor;break;}
  }
  if(complete)break;
 }
 if(!complete)return NextResponse.json({error:'Plaid returned too many pages or changed the data during sync; retry.'},{status:503});
 const rows=[...added,...modified].filter(t=>t.account_id===connection.account_id&&t.iso_currency_code==='USD').map(t=>({owner_id:user.id,transaction_id:t.transaction_id,account_id:t.account_id,date:t.date,name:String(t.merchant_name||t.name||'').slice(0,300),amount:-Number(t.amount),currency:'USD',pending:!!t.pending,updated_at:new Date().toISOString()}));
 // A cursor is only committed after transaction changes have been written successfully.
 for(let index=0;index<rows.length;index+=250){const {error:upsertError}=await database.from('plaid_bank_transactions').upsert(rows.slice(index,index+250),{onConflict:'owner_id,transaction_id'});if(upsertError)throw upsertError;}
 for(const r of removed){if(r.account_id!==connection.account_id)continue;const {error:removeError}=await database.from('plaid_bank_transactions').delete().eq('owner_id',user.id).eq('transaction_id',r.transaction_id);if(removeError)throw removeError;}
 const {error:saveError}=await database.from('plaid_connections').update({cursor:finalCursor||null,updated_at:new Date().toISOString()}).eq('owner_id',user.id);if(saveError)throw saveError;
 return NextResponse.json({synced:true,added:added.length,modified:modified.length,removed:removed.length,message:'Transactions are as recent as the latest data available from Plaid.'});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bank sync failed'},{status:503});}
}
