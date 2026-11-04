"use client";
import {useEffect,useState} from "react";
import {supabase} from "./supabase";
export default function Home(){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const [authorized,setAuthorized]=useState(false);
 const [tiktokBusy,setTiktokBusy]=useState(false);const [tiktokMessage,setTiktokMessage]=useState("");const [tiktokConnected,setTiktokConnected]=useState(false);
 async function tiktokStatus(){if(!supabase)return;const {data}=await supabase.auth.getSession();if(!data.session)return;try{const response=await fetch("/api/tiktok/status",{headers:{Authorization:`Bearer ${data.session.access_token}`}});const result=await response.json();if(response.ok)setTiktokConnected(!!result.connected)}catch{}}
 async function connectTiktok(){if(!supabase)return;setTiktokBusy(true);setTiktokMessage("");try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error("Please sign in again");const response=await fetch("/api/tiktok/start",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`}});const result=await response.json();if(!response.ok)throw Error(result.error||"Unable to start connection");window.location.assign(result.url)}catch(e){setTiktokMessage(e instanceof Error?e.message:"Unable to connect");setTiktokBusy(false)}}
 useEffect(()=>{if(authorized)tiktokStatus()},[authorized]);
 async function check(){if(!supabase){setMessage("Supabase environment variables are not configured yet.");setLoading(false);return}
 const {data:{user}}=await supabase.auth.getUser();
 if(!user){setAuthorized(false);setLoading(false);return}
 const {data,error}=await supabase.from("profiles").select("user_id").eq("user_id",user.id).maybeSingle();
 setAuthorized(!!data&&!error);if(!data)setMessage("Your login exists, but owner access has not been activated. Verify the owner allowlist and profile provisioning.");setLoading(false)}
 useEffect(()=>{check();if(!supabase)return;const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(check,0)});return()=>subscription.unsubscribe()},[]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message);setBusy(false)}
 async function reset(){if(!supabase||!email){setMessage("Enter your email first.");return}setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+"/auth/update-password"});setMessage(error?error.message:"If the address is registered, a password reset email has been sent.");setBusy(false)}
 async function logout(){await supabase?.auth.signOut();setAuthorized(false)}
 if(loading)return <main><p>Checking secure session…</p></main>;
 if(authorized)return <><header className="top"><div><b>SOUL</b> <span className="muted">/ Analytics</span></div><button onClick={logout}>Sign out</button></header><section className="dashboard"><h2>Overview</h2><p className="muted">Private owner dashboard · Setup mode</p><div className="cards">{["Revenue","Contribution Profit","Orders","Refunds"].map(x=><div className="stat" key={x}><small>{x}</small><strong>—</strong></div>)}</div><div className="notice"><b>TikTok Shop integration</b><p>Authorize your TikTok Shop to securely store access credentials. Orders and profit synchronization will be built next.</p><button className="connect" onClick={connectTiktok} disabled={tiktokBusy||tiktokConnected}>{tiktokConnected?"TikTok Shop authorized":tiktokBusy?"Connecting…":"Connect TikTok Shop"}</button>{tiktokMessage&&<p className="msg">{tiktokMessage}</p>}</div><div className="notice"><b>Backend setup in progress</b><p>Authentication is connected. We have not connected marketplace APIs or imported sales yet. No financial figures are displayed until validated.</p></div></section></>;
 return <main><div className="panel"><img className="logo" src="/soul-logo.jpg" alt="Soul logo"/><h1>Soul Analytics</h1><p className="sub">Private live-selling profit intelligence</p><form onSubmit={login}><label className="field" htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label className="field" htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button disabled={busy||!supabase}>Sign in</button></form><button className="link" onClick={reset} disabled={busy}>Reset password</button>{message&&<p className="msg">{message}</p>}</div></main>
}
