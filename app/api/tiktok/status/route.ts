import {NextRequest,NextResponse} from "next/server";
import {owner,db} from "../../../../lib/tiktok";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{const user=await owner(req.headers.get("authorization"));if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const {data,error}=await db().from("tiktok_connections").select("open_id,updated_at,access_expires_at").eq("owner_id",user.id).maybeSingle();if(error)return NextResponse.json({error:"Connection table unavailable"},{status:503});return NextResponse.json({connected:!!data,updatedAt:data?.updated_at||null,accessExpiresAt:data?.access_expires_at||null})}catch{return NextResponse.json({error:"Connection configuration incomplete"},{status:503})}}
