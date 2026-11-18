'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';
import AuthNotice,{type AuthMessage} from './AuthNotice';
export async function ebayRequest(path:string,method='GET',body?:unknown){
 const session=await supabase?.auth.getSession(),token=session?.data.session?.access_token;if(!token)throw Error('Sign in to manage your eBay account.');
 const response=await fetch('/api/ebay/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(data.error||'eBay request failed.');return data;
}
type Status={connected:boolean;configured:boolean;setupRequired:boolean;setupMessage:string;connection?:{username:string;last_sync_at:string|null;refresh_expires_at:string}};
export default function EbayConnection(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false),[notice,setNotice]=useState<AuthMessage|null>(null);
 const load=useCallback(async()=>{try{setStatus(await ebayRequest('status'));setError('');}catch(e){setError(e instanceof Error?e.message:'Connection unavailable.');}},[]);
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('soul:ebay-refresh',refresh);return()=>window.removeEventListener('soul:ebay-refresh',refresh);},[load]);
 async function connect(){setBusy(true);try{const data=await ebayRequest('connect','POST');const url=new URL(data.url);if(url.origin!=='https://auth.ebay.com')throw Error('Invalid authorization URL.');window.location.assign(url.toString());}catch(e){setNotice({id:Date.now(),title:'Could not connect eBay',text:e instanceof Error?e.message:'Try again.',error:true});setBusy(false);}}
 async function disconnect(){setBusy(true);try{await ebayRequest('status','DELETE');setConfirm(false);await load();window.dispatchEvent(new Event('soul:ebay-refresh'));setNotice({id:Date.now(),title:'eBay disconnected',text:'The saved account tokens were removed. Imported records remain private to your account.'});}catch(e){setNotice({id:Date.now(),title:'Could not disconnect',text:e instanceof Error?e.message:'Try again.',error:true});}finally{setBusy(false);}}
 const expired=status?.connection&&Date.parse(status.connection.refresh_expires_at)<=Date.now();
 return <section className="surface settingsPanel"><AuthNotice notice={notice}/><div className="surfaceHeader"><div><div className="eyebrow">YOUR MARKETPLACE ACCOUNT</div><h2>eBay connection</h2><p className="muted">Sign in on eBay and approve read access. Your eBay password and tokens never need to be pasted here.</p></div><span className={status?.connected&&!expired?'connectBadge connected':'connectBadge'}>{expired?'Reconnect needed':status?.connected?'Connected':'Not connected'}</span></div>
 {status?.connection&&<p className="muted">Seller: <strong>{status.connection.username}</strong></p>}
 {(error||status?.setupMessage)&&<p className="muted" role="status">{error||status?.setupMessage}</p>}
 <div className="settingsActions"><button className="primaryBtn" disabled={busy||!status?.configured||status.setupRequired} onClick={()=>void connect()}>{busy?'Working…':status?.connected?'Reconnect eBay':'Connect eBay'}</button>{status?.connected&&<button className="outlineBtn" disabled={busy} onClick={()=>setConfirm(!confirm)}>Disconnect</button>}</div>
 {confirm&&<div className="alertBox"><p>Remove this dashboard’s eBay authorization? Your imported records stay private. You can also revoke access in eBay’s third-party app settings.</p><button className="outlineBtn" disabled={busy} onClick={()=>void disconnect()}>Confirm disconnect</button></div>}
 <p className="muted" style={{fontSize:12}}>Each Soul user connects their own seller account. Tokens are encrypted on the server and refreshed when needed. An administrator configures the shared eBay app once; users do not need Vercel access.</p>
 </section>;
}
