'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';
type Session={id:string;title:string;startAt:string|null;minutes:number|null;gmv:number|null;orders:number|null;items:number|null;salesPerHour:number|null};
const dollars=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const duration=(n:number)=>`${Math.floor(n/60)}h ${Math.round(n%60)}m`;
export default function TikTokLiveEfficiency(){
 const [sessions,setSessions]=useState<Session[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[coverage,setCoverage]=useState('');
 const load=useCallback(async()=>{setLoading(true);try{const {data}=await supabase!.auth.getSession();if(!data.session)throw Error('Sign in again');const r=await fetch('/api/tiktok/live-efficiency',{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'LIVE analytics unavailable');setSessions(j.sessions||[]);setCoverage(j.coverage||'');setError('');}catch(e){setError(e instanceof Error?e.message:'LIVE analytics unavailable');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <section className="surface sePanel"><div className="seHead"><div><div className="eyebrow">TIKTOK SHOP / LIVE EFFICIENCY</div><h2>Livestream performance</h2><p className="muted">Actual LIVE sessions, duration and session-attributed GMV.</p></div><button className="outlineBtn" onClick={load} disabled={loading}>{loading?'Loading…':'Refresh LIVE data'}</button></div>
 {error?<div className="seNotice">{error}<div className="muted">This does not affect your normal TikTok order and finance data.</div></div>:loading?<p className="muted">Loading session analytics…</p>:!sessions.length?<p className="muted">No LIVE sessions returned in this period.</p>:<div className="seList">{sessions.map(s=><article className="seSession" key={s.id}><div className="seTitle"><strong>{s.title}</strong><small>{s.startAt?new Date(s.startAt).toLocaleString():'Start date unavailable'}</small></div><div className="seStats"><div><span>Time live</span><b>{s.minutes!==null?duration(s.minutes):'—'}</b></div><div><span>LIVE GMV</span><b>{s.gmv!==null?dollars(s.gmv):'—'}</b></div><div><span>GMV / hour</span><b>{s.salesPerHour!==null?dollars(s.salesPerHour):'—'}</b></div><div><span>Profit / hour</span><b className="seMuted">Not reconciled</b></div></div></article>)}</div>}
 <p className="seDisclaimer">{coverage||'LIVE data is independent of your order totals.'} TikTok LIVE GMV is not settled profit. Profit/hour requires reliable session-level attribution of fees, refunds and COGS; it is intentionally not estimated from all shop sales.</p></section>;
}
