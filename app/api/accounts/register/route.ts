import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/tiktok';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({signupEnabled:process.env.SELF_SERVICE_SIGNUP_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return NextResponse.json({error:'Sign in to finish creating your account.'},{status:401});
  const client=db();const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return NextResponse.json({error:'Your sign-in session expired. Sign in again.'},{status:401});
  // Never trust metadata, request bodies, or a caller-supplied user ID for admission.
  const existing=await client.from('profiles').select('user_id').eq('user_id',user.id).maybeSingle();
  if(existing.error)throw Error('Profile lookup failed');
  if(existing.data)return NextResponse.json({ready:true,created:false});
  if(process.env.SELF_SERVICE_SIGNUP_ENABLED!=='true')return NextResponse.json({error:'This account needs an invitation. Public signup is not enabled.'},{status:403});
  if(!user.email||!user.email_confirmed_at)return NextResponse.json({error:'Verify your email using the confirmation link before continuing.'},{status:403});
  const saved=await client.from('profiles').upsert({user_id:user.id,email:user.email},{onConflict:'user_id',ignoreDuplicates:true});
  if(saved.error)throw Error('Profile creation failed');
  return NextResponse.json({ready:true,created:true});
 }catch{return NextResponse.json({error:'Could not prepare your dashboard. Please try again. If this continues, the account database setup needs checking.'},{status:503});}
}
