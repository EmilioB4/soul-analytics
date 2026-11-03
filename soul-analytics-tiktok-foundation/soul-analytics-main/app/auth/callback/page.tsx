"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "../../supabase";
export default function Callback(){const router=useRouter();const [message,setMessage]=useState("Verifying sign-in…");
useEffect(()=>{async function run(){if(!supabase){setMessage("Missing Supabase configuration.");return}
const hash=new URLSearchParams(window.location.hash.slice(1));const query=new URLSearchParams(window.location.search);
const code=query.get("code");const token=query.get("token_hash");const type=query.get("type");
if(code){const {error}=await supabase.auth.exchangeCodeForSession(code);if(error){setMessage(error.message);return}}
else if(token&&type){const {error}=await supabase.auth.verifyOtp({token_hash:token,type:type as "invite"|"recovery"|"email"});if(error){setMessage(error.message);return}}
else if(hash.get("error")){setMessage(hash.get("error_description")||"Invitation expired. Request a new one.");return}
const {data:{session}}=await supabase.auth.getSession();if(!session){setMessage("No valid session. Request a fresh invitation.");return}
router.replace("/auth/update-password")}run()},[router]);return <main><div className="panel"><h1>Secure sign-in</h1><p className="sub">{message}</p></div></main>}
