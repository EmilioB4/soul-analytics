'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';

type Session={id:string;title:string;startAt:string|null;minutes:number|null;gmv:number|null;orders:number|null;items:number|null;salesPerHour:number|null};
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const clock=(n:number)=>`${Math.floor(n/60)}h ${Math.round(n%60)}m`;
const date=(s:string|null)=>s?new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date pending';
const time=(s:string|null)=>s?new Date(s).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):null;

export default function TikTokLiveEfficiency(){
 const [sessions,setSessions]=useState<Session[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [coverage,setCoverage]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [detailTab,setDetailTab]=useState<'performance'|'notes'>('performance');
 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const {data}=await supabase!.auth.getSession();
   if(!data.session)throw Error('Sign in again');
   const r=await fetch('/api/tiktok/live-efficiency',{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'LIVE analytics unavailable');
   setSessions(Array.isArray(j.sessions)?j.sessions:[]);
   setCoverage(j.coverage||'');
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'LIVE analytics unavailable');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const ordered=useMemo(()=>[...sessions].sort((a,b)=>(b.startAt||'').localeCompare(a.startAt||'')),[sessions]);
 const visible=useMemo(()=>ordered.filter(s=>`${s.title} ${s.startAt?date(s.startAt):''}`.toLowerCase().includes(query.toLowerCase())),[ordered,query]);
 const selected=ordered.find(s=>s.id===selectedId)||ordered[0]||null;
 const totalGmv=ordered.reduce((sum,s)=>sum+(s.gmv??0),0);
 const totalMinutes=ordered.reduce((sum,s)=>sum+(s.minutes??0),0);
 const hasMinutes=ordered.some(s=>s.minutes!==null);
 const knownGmv=ordered.some(s=>s.gmv!==null);
 const totalOrders=ordered.reduce((sum,s)=>sum+(s.orders??0),0);
 const hasOrders=ordered.some(s=>s.orders!==null);
 return <section className="ttIntelligence">
  <header className="ttIntHead">
   <div><div className="eyebrow">TIKTOK SHOP / STREAM INTELLIGENCE</div><h2>Show performance</h2><p className="muted">Your LIVE sessions, time on air, and session-attributed sales.</p></div>
   <button className="outlineBtn" onClick={load} disabled={loading}>{loading?'Loading…':'↻ Refresh LIVE data'}</button>
  </header>
  {error&&<div className="seNotice" role="alert">{error}<div className="muted">Your TikTok orders and finance data are unaffected.</div></div>}
  <div className="ttIntMetrics">
   <div className="ttIntMetric"><span>LIVE GMV</span><strong>{knownGmv?usd(totalGmv):'—'}</strong><small>Across returned LIVE sessions</small></div>
   <div className="ttIntMetric"><span>Time live</span><strong>{hasMinutes?clock(totalMinutes):'—'}</strong><small>Official session durations</small></div>
   <div className="ttIntMetric"><span>LIVE sessions</span><strong>{loading?'—':ordered.length.toLocaleString()}</strong><small>In the LIVE API response</small></div>
   <div className="ttIntMetric"><span>Session orders</span><strong>{hasOrders?totalOrders.toLocaleString():'—'}</strong><small>Not your full shop order count</small></div>
  </div>
  <div className="ttIntLayout">
   <div className="surface ttIntLibrary">
    <div className="eyebrow">SHOW LIBRARY</div><h3>Livestreams <span className="wnIntCount">{ordered.length}</span></h3>
    <input className="wnIntSearch" type="search" aria-label="Search TikTok LIVE sessions" placeholder="Search shows or dates…" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="ttIntShowList">
     {loading?<div className="ttIntEmpty">Loading LIVE sessions…</div>:!visible.length?<div className="ttIntEmpty">{ordered.length?'No shows match your search.':'No LIVE sessions returned.'}</div>:visible.map(s=><button type="button" key={s.id} className={'ttIntShow'+(selected?.id===s.id?' active':'')} onClick={()=>{setSelectedId(s.id);setDetailTab('performance');}} aria-pressed={selected?.id===s.id}>
      <span className="ttIntShowIcon" aria-hidden="true">▶</span><span className="ttIntShowMain"><strong>{s.title||'Untitled livestream'}</strong><small>{date(s.startAt)}{s.minutes!==null?` · ${clock(s.minutes)}`:''}</small></span><span className="ttIntShowEnd"><b>{s.gmv!==null?usd(s.gmv):'—'}</b><small>LIVE GMV</small></span>
     </button>)}
    </div>
    <div className="wnIntLibraryFoot">LIVE GMV is reported by TikTok and may differ from imported order subtotals or settled earnings.</div>
   </div>
   <div className="surface ttIntDetail">
    {selected?<>
     <div className="ttIntDetailTop"><div><div className="eyebrow">SELECTED STREAM</div><h3>{selected.title||'Untitled livestream'}</h3><div className="wnIntDate">{date(selected.startAt)}{time(selected.startAt)?` · ${time(selected.startAt)}`:''}</div></div><span className="ttIntBadge">LIVE analytics</span></div>
     <div className="ttIntNumbers"><div><span>LIVE GMV</span><strong>{selected.gmv!==null?usd(selected.gmv):'—'}</strong></div><div><span>Time live</span><strong>{selected.minutes!==null?clock(selected.minutes):'—'}</strong></div><div><span>GMV / hour</span><strong>{selected.salesPerHour!==null?usd(selected.salesPerHour):'—'}</strong></div></div>
     <section className="ttIntEfficiency"><div className="eyebrow">STREAM EFFICIENCY</div><h4>Time &amp; performance</h4><div className="ttIntEfficiencyGrid">
      <div><span>Session orders</span><strong>{selected.orders!==null?selected.orders.toLocaleString():'—'}</strong></div>
      <div><span>Orders / hour</span><strong>{selected.orders!==null&&selected.minutes!==null&&selected.minutes>0?(selected.orders*60/selected.minutes).toFixed(1):'—'}</strong></div>
      <div><span>Units sold</span><strong>{selected.items!==null?selected.items.toLocaleString():'—'}</strong></div>
      <div><span>Profit / hour</span><strong className="ttIntUnavailable">Not reconciled</strong></div>
     </div></section>
     <div className="ttIntTabs"><button type="button" className={detailTab==='performance'?'active':''} onClick={()=>setDetailTab('performance')}>Performance details</button><button type="button" className={detailTab==='notes'?'active':''} onClick={()=>setDetailTab('notes')}>Data notes</button></div>
     {detailTab==='performance'?<div className="ttIntBreakdown">
      <div><span>LIVE GMV</span><b>{selected.gmv!==null?usd(selected.gmv):'—'}</b></div>
      <div><span>Broadcast duration</span><b>{selected.minutes!==null?clock(selected.minutes):'—'}</b></div>
      <div><span>GMV per hour</span><b>{selected.salesPerHour!==null?usd(selected.salesPerHour):'—'}</b></div>
      <div><span>Attributed LIVE orders</span><b>{selected.orders!==null?selected.orders.toLocaleString():'—'}</b></div>
      <div><span>Profit per hour</span><b>Not reconciled</b></div>
     </div>:<div className="ttIntDataNotes">TikTok LIVE GMV is session-attributed and not the same as settled product sales. This stream does not have verified session-level COGS, commissions, refunds, and seller-paid shipping. Profit is deliberately not estimated from shop-wide totals.</div>}
    </>:<div className="ttIntEmpty">{loading?'Loading stream data…':'Select a livestream when LIVE analytics are available.'}</div>}
   </div>
  </div>
  <div className="ttIntFooter">{coverage||'LIVE data is independent of your imported shop orders.'} Sales Over Time and Top Sellers remain below this section and continue using imported TikTok orders.</div>
 </section>;
}
