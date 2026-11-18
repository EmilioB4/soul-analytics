'use client';
import ConnectionCheck from './ConnectionCheck';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
export default function WalmartConnection(){
 const [state,setState]=useState<{connected:boolean;legacy:boolean}|null>(null),[clientId,setId]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function request(method='GET'){
  const session=await supabase?.auth.getSession();if(!session?.data.session)throw Error('Sign in again to connect Walmart.');
  const res=await fetch('/api/connections/walmart',{method,headers:{Authorization:`Bearer ${session.data.session.access_token}`,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({clientId,clientSecret:secret})}:{}),cache:'no-store'});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Connection unavailable.');return data;
 }
 useEffect(()=>{const refresh=()=>void request().then(setState).catch(e=>setMessage(e.message));refresh();window.addEventListener('soul:connections-refresh',refresh);return()=>window.removeEventListener('soul:connections-refresh',refresh);},[]);
 return <section className="surface settingsPanel"><div className="surfaceHeader"><div><div className="eyebrow">YOUR MARKETPLACE ACCOUNT</div><h2>Walmart connection</h2><p className="muted">Connect your own Walmart Marketplace API credentials. Orders, inventory and payout checks use your account.</p></div><span className="pill">{state?.connected?'Connected':'Not connected'}</span></div>
 {state?.legacy&&<p className="muted">Your existing server connection is preserved. You do not need to enter credentials again.</p>}
 <details><summary>{state?.connected?'Update existing credentials':'Connect Walmart'}</summary><p className="muted">Get your Client ID and Client Secret from Walmart Marketplace API Key Management. Use read access for orders, items, WFS inventory, reports and returns. Never share your Walmart login password.</p>
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{await request('POST');setId('');setSecret('');setState(await request());setMessage('Walmart connected. Enable automatic updates below to start imports.');window.dispatchEvent(new Event('soul:automation-changed'));}catch(e){setMessage(e instanceof Error?e.message:'Connection failed.');}finally{setBusy(false);}}}>
 <label className="field" htmlFor="walmart-client-id">Client ID</label><input id="walmart-client-id" type="password" autoComplete="off" value={clientId} onChange={e=>setId(e.target.value)} required maxLength={1000}/>
 <label className="field" htmlFor="walmart-client-secret">Client Secret</label><input id="walmart-client-secret" type="password" autoComplete="new-password" value={secret} onChange={e=>setSecret(e.target.value)} required maxLength={2000}/>
 <p className="muted">Credentials are encrypted on the server and never displayed again.</p><button className="primaryBtn" disabled={busy}>{busy?'Verifying…':'Verify & save Walmart connection'}</button></form></details>{message&&<p role="status">{message}</p>}
 <ConnectionCheck platform="walmart" disabled={!state?.connected}/></section>;
}
