'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';

type WhatnotPeriod='day'|'week'|'month'|'ytd'|'custom';
const whatnotPeriodNames:Record<WhatnotPeriod,string>={day:'Today',week:'This week',month:'This month',ytd:'Year to date',custom:'Custom range'};
const nyDate=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const dateOf=(value:string)=>nyDate(new Date(value));
function periodBounds(period:WhatnotPeriod,start:string,end:string){
 const today=nyDate(new Date());const d=new Date(today+'T12:00:00Z');
 if(period==='custom')return {start,end};
 if(period==='day')return {start:today,end:today};
 if(period==='week'){const offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return {start:d.toISOString().slice(0,10),end:today};}
 if(period==='month')return {start:today.slice(0,7)+'-01',end:today};
 return {start:today.slice(0,4)+'-01-01',end:today};
}
type Summary={configured:boolean;orders:number;shows:number;recent:{external_id:string;status:string;created_at:string|null}[];recentShows:{external_id:string;title:string|null;status:string}[]};
type FinancialStream={id:string;title:string;firstSaleAt:string|null;gross:number;earnings:number;commission:number;processing:number;feeTaxes:number;shipping:number;refunds:number;otherAdjustments:number;orders:number;entries:number;cogs:number|null;profit:number|null};
type Finance={streams:FinancialStream[];ledgerEntries:number;reportRuns:{status:string;created_at:string;imported_at:string|null}[];totalEarnings:number;totalGross:number;warning?:string};
const usd=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const fmtDate=(s:string|null)=>s?new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date pending';
const number=(x:number)=>x.toLocaleString('en-US');
const label=(str:string)=>str.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());

export default function WhatnotDashboard(){
 const [period,setPeriod]=useState<WhatnotPeriod>('week');
 const [customStart,setCustomStart]=useState(''),[customEnd,setCustomEnd]=useState('');
 const [appliedRange,setAppliedRange]=useState<{start:string;end:string}|null>(null);
 const [rangeError,setRangeError]=useState('');
 const [summary,setSummary]=useState<Summary|null>(null);
 const [finance,setFinance]=useState<Finance|null>(null);
 const [busy,setBusy]=useState(false),[financeBusy,setFinanceBusy]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null),[filter,setFilter]=useState('');
 const [costInput,setCostInput]=useState(''),[editing,setEditing]=useState(false);
 const [detailsTab,setDetailsTab]=useState<'breakdown'|'activity'>('breakdown');
 const [showOrders,setShowOrders]=useState(false);
 const [showEfficiency,setShowEfficiency]=useState<{minutes:number|null;startAt:string|null;orders:number|null;warning:string|null}|null>(null);
 const [showEfficiencyError,setShowEfficiencyError]=useState('');
 const [showEfficiencyLoading,setShowEfficiencyLoading]=useState(false);
 const request=useCallback(async(path:string,method='GET')=>{
  const {data}=await supabase!.auth.getSession();if(!data.session)throw Error('Sign in again.');
  const resp=await fetch(path,{method,headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});
  const json=await resp.json();if(!resp.ok)throw Error(json.error||'Request failed');return json;
 },[]);
 const refresh=useCallback(async()=>{
  try{const [a,b]=await Promise.all([request('/api/whatnot/summary'),request('/api/whatnot/finance')]);setSummary(a);setFinance(b);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load Whatnot data');}
 },[request]);
 useEffect(()=>{void refresh();},[refresh]);
 const shows=useMemo(()=>[...(finance?.streams||[])].filter(s=>s.id!=='unassigned').sort((a,b)=>(b.firstSaleAt||'').localeCompare(a.firstSaleAt||'')),[finance]);
 const bounds=periodBounds(period,appliedRange?.start||'',appliedRange?.end||'');
 const dateReady=period!=='custom'||!!appliedRange;
 const filteredShows=useMemo(()=>dateReady?shows.filter(s=>{if(!s.firstSaleAt)return false;const day=dateOf(s.firstSaleAt);return day>=bounds.start&&day<=bounds.end;}):[],[shows,dateReady,bounds.start,bounds.end]);
 const selected=filteredShows.find(s=>s.id===selectedId)||filteredShows[0]||null;
 useEffect(()=>{let canceled=false;setShowEfficiency(null);setShowEfficiencyError('');if(!selected)return;setShowEfficiencyLoading(true);(async()=>{try{const {data}=await supabase!.auth.getSession();if(!data.session)throw Error('Sign in again');const r=await fetch(`/api/whatnot/show-efficiency?show_id=${encodeURIComponent(selected.id)}`,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Show analytics unavailable');if(!canceled)setShowEfficiency(j);}catch(e){if(!canceled)setShowEfficiencyError(e instanceof Error?e.message:'Show analytics unavailable');}finally{if(!canceled)setShowEfficiencyLoading(false);}})();return()=>{canceled=true};},[selected?.id]);
 const visible=filteredShows.filter(s=>(s.title+' '+s.id+' '+fmtDate(s.firstSaleAt)).toLowerCase().includes(filter.toLowerCase()));
 const reconciled=filteredShows.filter(s=>s.cogs!==null);
 const totalProfit=reconciled.reduce((sum,s)=>sum+(s.profit??0),0);
 const missing=filteredShows.filter(s=>s.cogs===null).length;
 const filteredGross=filteredShows.reduce((sum,s)=>sum+s.gross,0);
 const filteredEarnings=filteredShows.reduce((sum,s)=>sum+s.earnings,0);
 const filteredEntries=filteredShows.reduce((sum,s)=>sum+s.entries,0);
 const fees=(s:FinancialStream)=>s.commission+s.processing+s.feeTaxes;
 async function syncOrders(){setBusy(true);setNotice('');setError('');try{const x=await request('/api/whatnot/sync','POST');setNotice(`${x.ordersProcessed} orders and ${x.showsProcessed} shows processed. Existing records deduplicated.`);await refresh();}catch(e){setError(e instanceof Error?e.message:'Order sync failed');}finally{setBusy(false);}}
 async function syncReports(){setFinanceBusy(true);setNotice('');setError('');try{const x=await request('/api/whatnot/finance','POST');setNotice(`Financial reports: ${x.reportsGenerated} requested, ${x.reportsCompleted} completed, ${x.ledgerRowsProcessed} ledger entries processed. A new report may take another sync cycle.`);await refresh();}catch(e){setError(e instanceof Error?e.message:'Financial sync failed');}finally{setFinanceBusy(false);}}
 async function saveCost(st:FinancialStream){const cost=Number(costInput);if(!costInput.trim()||!Number.isFinite(cost)||cost<0){setError('Enter a valid total COGS amount of zero or greater.');return;}setFinanceBusy(true);setError('');try{const {data}=await supabase!.auth.getSession();if(!data.session)throw Error('Sign in again.');const resp=await fetch('/api/whatnot/cogs',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({livestream_id:st.id,livestream_title:st.title,total_cogs:Math.round(cost*100)/100})});const json=await resp.json();if(!resp.ok)throw Error(json.error||'Could not save COGS');setEditing(false);setNotice(`COGS saved for ${st.title}.`);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not save stream COGS');}finally{setFinanceBusy(false);}}
 function selectShow(st:FinancialStream){setSelectedId(st.id);setEditing(false);setCostInput(st.cogs===null?'':String(st.cogs));setDetailsTab('breakdown');}
 return <div className="wnDashboard wnIntelligence">
  <div className="wnIntHead"><div><div className="eyebrow">WHATNOT / STREAM INTELLIGENCE</div><h2>Show performance</h2><p className="muted">Every show, its settled financials, and one simple COGS entry.</p></div><div className="wnIntActions"><button className="outlineBtn" onClick={syncOrders} disabled={busy||!summary?.configured}>{busy?'Syncing…':'Sync orders'}</button><button className="primaryBtn" onClick={syncReports} disabled={financeBusy||!summary?.configured}>{financeBusy?'Syncing…':'↻ Sync financials'}</button></div></div>
  <div className="filters"><div className="filterLabel">REPORTING PERIOD</div><div className="segment">{(['day','week','month','ytd','custom'] as WhatnotPeriod[]).map(p=><button key={p} className={period===p?'selected':''} onClick={()=>{setPeriod(p);setRangeError('');}}>{whatnotPeriodNames[p]}</button>)}</div><div className="dateRange">{dateReady?`${bounds.start} — ${bounds.end}`:'Select dates below'}</div>{period==='custom'&&<div className="customRangePanel" style={{display:'flex',alignItems:'end',gap:12,flexWrap:'wrap',padding:'12px 0'}}><label style={{display:'flex',flexDirection:'column',gap:5,fontSize:12}}>From <input style={{colorScheme:'dark',background:'#252832',color:'#fff',border:'1px solid #47465c',borderRadius:8,padding:9}} aria-label="Whatnot start date" type="date" value={customStart} max={customEnd||undefined} onChange={e=>setCustomStart(e.target.value)}/></label><label style={{display:'flex',flexDirection:'column',gap:5,fontSize:12}}>To <input style={{colorScheme:'dark',background:'#252832',color:'#fff',border:'1px solid #47465c',borderRadius:8,padding:9}} aria-label="Whatnot end date" type="date" value={customEnd} min={customStart||undefined} onChange={e=>setCustomEnd(e.target.value)}/></label><button className="outlineBtn" onClick={()=>{if(!customStart||!customEnd){setRangeError('Choose both dates.');return;}if(customStart>customEnd){setRangeError('Start date must be on or before end date.');return;}if(customEnd>nyDate(new Date())){setRangeError('End date cannot be in the future.');return;}setRangeError('');setAppliedRange({start:customStart,end:customEnd});}}>Apply dates</button>{rangeError&&<div style={{color:'#ffb6bb',fontSize:12,flexBasis:'100%'}} role="alert">{rangeError}</div>}</div>}<div className="muted" style={{fontSize:11}}>Whatnot financial totals are grouped by each show’s first recorded sale date. Undated and unassigned ledger entries are excluded from period totals.</div></div>
  {error&&<div className="alertBox" role="alert">{error}</div>}{notice&&<div className="alertBox" role="status">{notice}</div>}
  <div className="wnIntMetrics">
   <div className="wnIntMetric"><span>Settled merchandise sales</span><strong>{finance?usd(filteredGross):'—'}</strong><small>From imported financial ledger</small></div>
   <div className="wnIntMetric"><span>Net earnings before COGS</span><strong>{finance?usd(filteredEarnings):'—'}</strong><small>Includes recorded fees and adjustments</small></div>
   <div className="wnIntMetric"><span>Tracked stream profit</span><strong className={missing?'wnIntSoft':'wnIntAccent'}>{reconciled.length?usd(totalProfit):'—'}</strong><small>{missing?`${missing} show${missing===1?'':'s'} still need COGS · partial total`:'Shows with saved COGS only'}</small></div>
   <div className="wnIntMetric"><span>Tracked profit margin</span><strong>{reconciled.length&&reconciled.reduce((sum,st)=>sum+st.gross,0)>0?`${(totalProfit/reconciled.reduce((sum,st)=>sum+st.gross,0)*100).toFixed(1)}%`:'—'}</strong><small>{missing?`Partial · ${missing} show${missing===1?'':'s'} missing COGS`:'Profit ÷ sales for shows with saved COGS'}</small></div>
  </div>
  <section className="surface chartCard" aria-label="Whatnot sales over time">
   <div className="surfaceHeader"><div><div className="eyebrow">SALES PERFORMANCE</div><h2>Sales over time</h2><p className="muted">Settled merchandise sales from your imported Whatnot streams</p></div><div className="chartTotal">{finance?usd(filteredGross):'—'}<small>{whatnotPeriodNames[period]}</small></div></div>
   {(() => {
    const days=new Map<string,number>();
    for(const st of filteredShows){if(!st.firstSaleAt)continue;const d=dateOf(st.firstSaleAt);const key=period==='ytd'?d.slice(0,7):d;days.set(key,(days.get(key)||0)+st.gross);}
    const keys:string[]=[];
    if(dateReady&&bounds.start&&bounds.end){
     if(period==='ytd'){for(let m=1;m<=Number(bounds.end.slice(5,7));m++)keys.push(`${bounds.start.slice(0,4)}-${String(m).padStart(2,'0')}`);}
     else {const cursor=new Date(`${bounds.start}T12:00:00Z`);const endDate=new Date(`${bounds.end}T12:00:00Z`);while(cursor<=endDate&&keys.length<370){keys.push(cursor.toISOString().slice(0,10));cursor.setUTCDate(cursor.getUTCDate()+1);}}
    }
    if(!keys.length)return <div className="empty">Select a reporting period to see sales.</div>;
    const w=900,h=280,left=65,top=16,bottom=43,right=16,plotW=w-left-right,plotH=h-top-bottom;
    const max=Math.max(1,...keys.map(k=>days.get(k)||0))*1.16;
    const coords=keys.map((k,i)=>({x:left+(keys.length===1?plotW/2:i*plotW/(keys.length-1)),y:top+plotH-((days.get(k)||0)/max)*plotH}));
    const line=coords.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area=line+` L${coords[coords.length-1].x},${top+plotH} L${coords[0].x},${top+plotH} Z`;
    const every=Math.max(1,Math.ceil(keys.length/9));
    const display=(k:string)=>period==='ytd'?new Date(`${k}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}):new Date(`${k}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
    return <div className="chartArea"><div className="chartHint">Merchandise sales subtotal · USD <span>Hover over points for details</span></div><svg className="salesChart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Whatnot merchandise sales over time">
     <defs><linearGradient id="whatnotSalesArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7BE9EF" stopOpacity=".28"/><stop offset="1" stopColor="#7BE9EF" stopOpacity="0"/></linearGradient></defs>
     {[0,.25,.5,.75,1].map(v=><g key={v}><line x1={left} x2={w-right} y1={top+plotH*(1-v)} y2={top+plotH*(1-v)} stroke="#283340" strokeDasharray="4 7"/><text x={left-12} y={top+plotH*(1-v)+4} textAnchor="end" fill="#8294a1" fontSize="12">${Math.round(max*v).toLocaleString()}</text></g>)}
     <path d={area} fill="url(#whatnotSalesArea)"/><path d={line} fill="none" stroke="#7BE9EF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
     {coords.map((pt,i)=><g key={keys[i]}><circle cx={pt.x} cy={pt.y} r="3.5" fill="#7BE9EF" stroke="#0c151c" strokeWidth="2"><title>{`${display(keys[i])}: ${usd(days.get(keys[i])||0)}`}</title></circle><rect x={Math.max(left,pt.x-plotW/keys.length/2)} y={top} width={Math.max(7,plotW/keys.length)} height={plotH} fill="transparent"><title>{`${display(keys[i])}: ${usd(days.get(keys[i])||0)}`}</title></rect>{(i%every===0||i===keys.length-1)&&<text x={pt.x} y={h-15} textAnchor="middle" fill="#8da3ad" fontSize="12">{display(keys[i])}</text>}</g>)}
    </svg></div>;
   })()}
   <p className="muted" style={{fontSize:11,marginTop:8}}>Sales are attributed to each stream’s first recorded sale date, not individual transaction timestamps.</p>
  </section>
  {!summary?.configured&&<div className="alertBox" role="alert">Whatnot API is not configured. Add your token securely in Vercel.</div>}
  <section className="wnIntLayout">
   <div className="surface wnIntLibrary"><div className="wnIntPanelHead"><div><div className="eyebrow">SHOW LIBRARY</div><h3>Livestreams <span className="wnIntCount">{filteredShows.length}</span></h3></div></div><input className="wnIntSearch" type="search" placeholder="Search shows or dates…" aria-label="Search Whatnot shows" value={filter} onChange={e=>setFilter(e.target.value)}/>
    <div className="wnIntShowList">{visible.map(st=><button className={'wnIntShow'+(selected?.id===st.id?' active':'')} key={st.id} onClick={()=>selectShow(st)}><span className="wnIntShowIcon" aria-hidden="true">▶</span><span className="wnIntShowMain"><strong>{st.title}</strong><small>{st.firstSaleAt?`First sale ${fmtDate(st.firstSaleAt)}`:'Sale date not available'} · {st.entries} ledger entries</small></span><span className="wnIntShowEnd"><b>{usd(st.gross)}</b><small className={st.cogs===null?'wnIntPending':'wnIntDone'}>{st.cogs===null?'COGS needed':'Profit recorded'}</small></span></button>)}{!visible.length&&<div className="wnIntEmpty">{!dateReady?'Apply a custom date range.':shows.length?'No shows match your selected dates or search.':'No financial shows imported yet. Sync financial reports to get started.'}</div>}</div>
    <div className="wnIntLibraryFoot">{summary?.orders??'—'} imported API orders · {summary?.shows??'—'} show records. Order pagination is still being verified; ledger activity is tracked separately.</div>
   </div>
   <div className="surface wnIntDetail">{selected?<>
    <div className="wnIntDetailTop"><div><div className="eyebrow">SELECTED STREAM</div><h3>{selected.title}</h3><div className="wnIntDate">{selected.firstSaleAt?`First recorded sale · ${fmtDate(selected.firstSaleAt)}`:'First sale date unavailable'}</div></div><span className={'wnIntStatus '+(selected.cogs===null?'pending':'done')}>{selected.cogs===null?'COGS needed':'COGS saved'}</span></div>
    <div className="wnIntNumbers"><div><span>Merchandise sales</span><strong>{usd(selected.gross)}</strong></div><div><span>Net ledger earnings</span><strong>{usd(selected.earnings)}</strong></div><div><span>Contribution profit</span><strong className={selected.profit===null?'wnIntSoft':selected.profit>=0?'wnIntAccent':'wnIntNegative'}>{selected.profit===null?'Add COGS':usd(selected.profit)}</strong></div></div>
    <section className="seWhatnot"><div className="seHead"><div><div className="eyebrow">STREAM EFFICIENCY</div><h3>Time &amp; performance</h3></div><span className="seMuted">Official broadcast analytics</span></div><div className="seStats"><div><span>Time live</span><b>{showEfficiency?.minutes?`${Math.floor(showEfficiency.minutes/60)}h ${Math.round(showEfficiency.minutes%60)}m`:'—'}</b></div><div><span>Sales / hour</span><b>{showEfficiency?.minutes?usd(selected.gross*60/showEfficiency.minutes):'—'}</b></div><div><span>Profit / hour</span><b className={selected.profit!==null&&selected.profit<0?'wnIntNegative':''}>{showEfficiency?.minutes&&selected.profit!==null?usd(selected.profit*60/showEfficiency.minutes):'—'}</b></div><div><span>Orders / hour</span><b>{showEfficiency?.minutes&&showEfficiency.orders!==null?(showEfficiency.orders*60/showEfficiency.minutes).toFixed(1):'—'}</b></div></div>{showEfficiencyLoading&&<p className="seDisclaimer">Loading broadcast duration…</p>}{showEfficiencyError&&<p className="seDisclaimer">{showEfficiencyError}</p>}{showEfficiency?.warning&&<p className="seDisclaimer">{showEfficiency.warning}</p>}<p className="seDisclaimer">Sales and profit use settled ledger totals and your saved stream COGS. They may change as later adjustments post. Order rate uses Whatnot show analytics, not the partial order import.</p></section>
    <div className="wnIntCogs"><div><span className="wnIntCogsLabel">TOTAL STREAM COGS</span><p>One cost for everything sold in this show—even when listings are generic.</p></div>{editing?<div className="wnIntCogsEdit"><input autoFocus aria-label="Total stream COGS in dollars" type="number" min="0" step="0.01" value={costInput} onChange={e=>setCostInput(e.target.value)} placeholder="0.00"/><button className="primaryBtn" disabled={financeBusy} onClick={()=>saveCost(selected)}>Save</button><button className="outlineBtn" onClick={()=>setEditing(false)}>Cancel</button></div>:<button className="outlineBtn" onClick={()=>{setEditing(true);setCostInput(selected.cogs===null?'':String(selected.cogs));}}>{selected.cogs===null?'+ Add COGS':`${usd(selected.cogs)} · Edit`}</button>}</div>
    <div className="wnIntTabs"><button className={detailsTab==='breakdown'?'active':''} onClick={()=>setDetailsTab('breakdown')}>Financial breakdown</button><button className={detailsTab==='activity'?'active':''} onClick={()=>setDetailsTab('activity')}>Reconciliation</button></div>
    {detailsTab==='breakdown'?<div className="wnIntBreakdown"><div><span>Merchandise sales</span><b>{usd(selected.gross)}</b></div><div><span>Commission</span><b>−{usd(selected.commission)}</b></div><div><span>Processing & fee taxes</span><b>−{usd(selected.processing+selected.feeTaxes)}</b></div><div><span>Shipping deductions</span><b>−{usd(selected.shipping)}</b></div><div><span>Refund ledger adjustments</span><b className={selected.refunds<0?'wnIntNegative':''}>{usd(selected.refunds)}</b></div>{selected.otherAdjustments!==0&&<div><span>Other ledger adjustments</span><b>{usd(selected.otherAdjustments)}</b></div>}<div className="wnIntTotal"><span>Net ledger earnings</span><b>{usd(selected.earnings)}</b></div>{selected.cogs!==null&&<><div><span>Saved stream COGS</span><b>−{usd(selected.cogs)}</b></div><div className="wnIntTotal"><span>Contribution profit</span><b className={selected.profit!==null&&selected.profit<0?'wnIntNegative':'wnIntAccent'}>{usd(selected.profit??0)}</b></div></>}</div>:<div className="wnIntReconcile"><strong>{selected.entries} financial ledger entries</strong><p>The imported ledger includes original earnings and subsequent adjustments. Earnings already reflect these adjustments, so displayed fees and refunds are not subtracted again.</p><p>Show dates currently use the first recorded sale, not verified broadcast start times. Unassigned adjustments are excluded from this show until reliably matched.</p></div>}
   </>:<div className="wnIntEmpty">Select a show once its financial report has been imported.</div>}</div>
  </section>
  <div className="wnIntFoot"><div><strong>Data integrity</strong><p>Net earnings reflect signed Whatnot ledger transactions, not payouts. Show-level profit requires saved COGS. Unassigned fees and late adjustments may affect overall totals.</p></div><button className="outlineBtn" onClick={()=>setShowOrders(x=>!x)}>{showOrders?'Hide':'View'} recent orders</button></div>
  {showOrders&&<section className="surface wnIntOrders"><div className="wnIntPanelHead"><h3>Recent imported orders</h3><button className="outlineBtn" onClick={refresh}>Refresh</button></div><div className="tableScroll"><table className="modernTable"><thead><tr><th>Order ID</th><th>Status</th><th>Date</th></tr></thead><tbody>{(summary?.recent||[]).map(x=><tr key={x.external_id}><td className="mono">{x.external_id}</td><td>{label(x.status)}</td><td>{x.created_at?new Date(x.created_at).toLocaleString():'—'}</td></tr>)}</tbody></table>{!summary?.recent.length&&<div className="wnIntEmpty">No orders imported yet.</div>}</div></section>}
 </div>;
}
