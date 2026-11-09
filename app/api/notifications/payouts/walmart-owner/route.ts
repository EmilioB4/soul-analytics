import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../../lib/tiktok';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(process.env.WALMART_OWNER_ID)return NextResponse.json(process.env.WALMART_OWNER_ID===user.id?{linked:true}:{error:'Walmart is assigned to another owner in Vercel.'},{status:process.env.WALMART_OWNER_ID===user.id?200:409});
 const client=db();const profiles=await client.from('profiles').select('user_id').limit(2);
 if(profiles.error||profiles.data?.length!==1||profiles.data[0].user_id!==user.id)return NextResponse.json({error:'For a workspace with multiple owners, assign WALMART_OWNER_ID in Vercel explicitly.'},{status:409});
 // A unique platform key prevents another owner from replacing an existing binding.
 const save=await client.from('payout_platform_owners').upsert({platform:'walmart',owner_id:user.id},{onConflict:'platform',ignoreDuplicates:true});if(save.error)throw Error('Run supabase/payout_notifications_fast.sql in Supabase first.');
 const binding=await client.from('payout_platform_owners').select('owner_id').eq('platform','walmart').maybeSingle();if(binding.error||binding.data?.owner_id!==user.id)return NextResponse.json({error:'Walmart is already linked to another owner.'},{status:409});
 return NextResponse.json({linked:true});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not link Walmart.'},{status:503});}}
