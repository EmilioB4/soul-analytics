'use client';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
export default function AccountLogin({accessMessage=''}:{accessMessage?:string}){
 const [signupEnabled,setSignupEnabled]=useState(false),[mode,setMode]=useState<'login'|'signup'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void fetch('/api/accounts/register',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setSignupEnabled(data?.signupEnabled===true);}).catch(()=>{});return()=>{active=false;};},[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!supabase)return;setBusy(true);setMessage('');
  try{
   if(mode==='signup'){
    if(!signupEnabled)throw Error('Public signup is not available.');
    const {error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/'}});
    if(error)throw error;setPassword('');setMessage('Check your email for a confirmation link. After confirming, return here and sign in.');
   }else{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
  }catch(e){setMessage(e instanceof Error?e.message:'Could not sign in. Please try again.');}finally{setBusy(false);}
 }
 async function reset(){if(!supabase||!email.trim()){setMessage('Enter your email first.');return;}setBusy(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/auth/update-password'});setMessage(error?error.message:'If registered, a password reset email has been sent.');}catch{setMessage('Could not send the reset email. Please try again.');}finally{setBusy(false);}}
 return <main className="loginScreen"><div className="loginPanel"><div className="loginBrand"><img className="loginLogo" src="/soul-iridescent-logo.jpg" alt="Soul logo"/><div className="loginLogoCaption">SOUL <small>ANALYTICS</small></div></div>
 <h1>{mode==='signup'?'Create your account':'Welcome back'}</h1><p className="sub">{mode==='signup'?'Your own private dashboard for your seller accounts.':'Sign in to your private seller workspace'}</p>
 <form onSubmit={submit}><label className="field" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label className="field" htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?12:undefined} value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='signup'&&<p className="muted" style={{fontSize:12}}>Use at least 12 characters. We’ll email you a verification link.</p>}
 <button className="primaryBtn" disabled={busy||!supabase}>{busy?'Please wait…':mode==='signup'?'Create account':'Sign in'}</button></form>
 {signupEnabled&&<button className="textBtn" disabled={busy} onClick={()=>{setMode(mode==='login'?'signup':'login');setPassword('');setMessage('');}}>{mode==='login'?'New here? Create an account':'Already have an account? Sign in'}</button>}
 {mode==='login'&&<button className="textBtn" onClick={()=>void reset()} disabled={busy}>Forgot password?</button>}
 {(message||accessMessage)&&<p className="msg" role="status">{message||accessMessage}</p>}
 </div></main>;
}
