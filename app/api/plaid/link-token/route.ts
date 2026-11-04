import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {plaid} from '../../../../lib/plaid';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {data:existing,error}=await db().from('plaid_connections').select('item_id').eq('owner_id',user.id).maybeSingle();if(error)throw Error('Run the Plaid database migration first');
 if(existing)return NextResponse.json({error:'Bank already linked. Reconnect through Plaid support if access has expired.'},{status:409});
 const redirect=process.env.PLAID_REDIRECT_URI;
 const payload:Record<string,unknown>={client_name:'Soul Analytics',user:{client_user_id:user.id},products:['transactions'],country_codes:['US'],language:'en'};
 if(redirect){if(!redirect.startsWith('https://'))throw Error('PLAID_REDIRECT_URI must use HTTPS');payload.redirect_uri=redirect;}
 const result=await plaid('/link/token/create',payload);
 return NextResponse.json({linkToken:result.link_token});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not start bank connection'},{status:503});}
}
