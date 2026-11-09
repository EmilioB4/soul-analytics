import {db} from './tiktok';
export async function walmartPayoutOwnerMatches(ownerId:string){
 if(process.env.WALMART_OWNER_ID)return process.env.WALMART_OWNER_ID===ownerId;
 try{const {data,error}=await db().from('payout_platform_owners').select('owner_id').eq('platform','walmart').maybeSingle();return !error&&data?.owner_id===ownerId;}catch{return false;}
}
