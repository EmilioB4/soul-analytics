'use client';
import {useState} from 'react';
import {supabase} from './supabase';
import AuthNotice,{type AuthMessage} from './AuthNotice';
export default function ConnectionCheck({platform,disabled=false}:{platform:'walmart'|'tiktok'|'whatnot';disabled?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState<AuthMessage|null>(null);
 async function verify(){setBusy(true);try{const session=await supabase?.auth.getSession();if(!session?.data.session)throw Error('Sign in again to check your connection.');const result=await fetch('/api/connections/verify',{method:'POST',headers:{Authorization:'Bearer '+session.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({platform}),cache:'no-store'});const data=await result.json();if(!result.ok)throw Error(data.error||'Connection check failed.');setNotice({id:Date.now(),title:'Connection verified',text:data.message});}catch(e){setNotice({id:Date.now(),title:'Connection needs attention',text:e instanceof Error?e.message:'Try again.',error:true});}finally{setBusy(false);}}
 return <div style={{marginTop:16}}><AuthNotice notice={notice}/><button className="outlineBtn" disabled={disabled||busy} onClick={()=>void verify()}>{busy?'Checking…':'Test connection'}</button></div>;
}
