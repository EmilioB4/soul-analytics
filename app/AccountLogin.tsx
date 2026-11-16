'use client';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import AuthFrame from './AuthFrame';
import AuthNotice,{type AuthMessage} from './AuthNotice';
import {signInAccount} from '../lib/account-signin';
export default function AccountLogin({accessMessage='',onSignInStart,onSignInEnd}:{accessMessage?:string;onSignInStart?:()=>void;onSignInEnd?:(success:boolean)=>void}){
 const [signupEnabled,setSignupEnabled]=useState(false),[mode,setMode]=useState<'login'|'signup'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<AuthMessage|null>(null);
 const notify=(title:string,text:string,error=false)=>setNotice({id:Date.now(),title,text,error});
 useEffect(()=>{if(accessMessage)notify('Account access',accessMessage,true);},[accessMessage]);
 useEffect(()=>{let active=true;void fetch('/api/accounts/register',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setSignupEnabled(data?.signupEnabled===true);}).catch(()=>{});return()=>{active=false;};},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);setNotice(null);let authenticated=false;if(mode==='login')onSignInStart?.();
  try{
   if(mode==='signup'){
    if(!signupEnabled)throw Error('Public signup is not available.');
    const {error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/'}});
    if(error)throw error;setPassword('');notify('Check your inbox','If this address is eligible, a confirmation link will arrive shortly. Already registered? Sign in instead.');
   }else{await signInAccount(supabase.auth,email,password);authenticated=true;}
  }catch(e){notify('Unable to continue',e instanceof Error?e.message:'Please try again.',true);}finally{if(mode==='login')onSignInEnd?.(authenticated);setBusy(false);}
 }
 async function reset(){if(!supabase||!email.trim()){notify('Email needed','Enter your email address, then choose Forgot password.',true);return;}setBusy(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/auth/update-password'});if(error)notify('Reset email unavailable',error.message,true);else notify('Check your inbox','If this address is registered, a password reset link will arrive shortly. Check your spam folder too.');}catch{notify('Reset email unavailable','Please try again in a moment.',true);}finally{setBusy(false);}}
 return <><AuthFrame>
 <h1>{mode==='signup'?'Create your account':'Welcome back'}</h1><p className="sub">{mode==='signup'?'Your own private dashboard for your seller accounts.':'Sign in to your private seller workspace'}</p>
 <form onSubmit={submit}><label className="field" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label className="field" htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?12:undefined} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='signup'&&<p className="muted" style={{fontSize:12}}>Use at least 12 characters. We’ll email you a verification link.</p>}
 <button className="primaryBtn" disabled={busy||!supabase}>{busy?'Please wait…':mode==='signup'?'Create account':'Sign in'}</button></form>
 {signupEnabled&&<button className="textBtn" disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setPassword('');setNotice(null);}}>{mode==='login'?'New here? Create an account':'Already have an account? Sign in'}</button>}
 {mode==='login'&&<button className="textBtn" onClick={()=>void reset()} disabled={busy}>Forgot password?</button>}
 </AuthFrame><AuthNotice notice={notice}/></>;
}
