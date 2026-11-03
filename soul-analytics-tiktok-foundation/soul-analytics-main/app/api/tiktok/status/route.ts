import {NextRequest,NextResponse} from "next/server";
import {admin,owner} from "../../../../lib/tiktok-server";
export const runtime="nodejs";
export async function GET(req:NextRequest){try{const user=await owner(req.headers.get("authorization"));if(!user)return NextResponse.json({error:"Not authorized"},{status:401});const {data,error}=await admin().from("tiktok_connections").select("shop_id").eq("user_id",user.id).limit(1).maybeSingle();if(error)return NextResponse.json({error:"Run the TikTok connection database migration first"},{status:503});return NextResponse.json({connected:!!data})}catch{return NextResponse.json({error:"Server configuration incomplete"},{status:503})}}
