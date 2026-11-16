'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../supabase';
import AuthFrame from '../../AuthFrame';
import AuthNotice,{type AuthMessage} from '../../AuthNotice';
export default function UpdatePassword(){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true),[ready,setReady]=useState(false),[saved,setSaved]=useState(false);
 const [notice,setNotice]=useState<AuthMessage|null>(null);
 const notify=(title:string,text:string,error=false)=>setNotice({id:Date.now(),title,text,error});
 useEffect(()=>{let active=true;async function check(){try{if(!supabase)throw Error('The sign-in service is not configured.');const {data:{user},error}=await supabase.auth.getUser();if(!active)return;if(error||!user)throw Error('This link is invalid or expired. Request a new reset email from the sign-in page.');setReady(true);}catch(e){if(active)notify('Reset link unavailable',e instanceof Error?e.message:'Request a new reset email.',true);}finally{if(active)setChecking(false);}}void check();return()=>{active=false;};},[]);
 async function save(e:React.FormEvent){
  e.preventDefault();if(!supabase||busy||!ready)return;
  if(password!==confirmation){notify('Passwords do not match','Enter the same new password in both fields.',true);return;}
  setBusy(true);setNotice(null);
  try{const {data:{user},error:sessionError}=await supabase.auth.getUser();if(sessionError||!user)throw Error('Your reset session expired. Request a new reset email.');const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword('');setConfirmation('');setSaved(true);notify('Password updated','Your new password is saved. You can now continue to your dashboard.');}
  catch(e){notify('Password not updated',e instanceof Error?e.message:'Please try again.',true);}finally{setBusy(false);}
 }
 return <><AuthFrame><div className="authEyebrow">ACCOUNT RECOVERY</div><h1>{saved?'You’re all set':'Set a new password'}</h1><p className="sub">{saved?'Your password has been updated.':'Choose a strong password for your Soul account.'}</p>
 {saved?<a className="primaryBtn authContinue" href="/">Continue to dashboard <span aria-hidden="true">↗</span></a>:<form onSubmit={save} aria-busy={busy||checking}><label className="field" htmlFor="new-password">New password</label><input id="new-password" type="password" required minLength={12} autoComplete="new-password" disabled={!ready||busy} value={password} onChange={e=>setPassword(e.target.value)}/><label className="field" htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" required minLength={12} autoComplete="new-password" disabled={!ready||busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><p className="authHelp">Use at least 12 characters.</p><button className="primaryBtn" disabled={!ready||busy||checking}>{checking?'Checking reset link…':busy?'Saving…':'Save new password'}</button></form>}
 {!saved&&<a className="textBtn authBack" href="/">← Back to sign in</a>}
 </AuthFrame><AuthNotice notice={notice}/></>;
}
