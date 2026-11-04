"use client";
import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';
type Payment={id:string;status:string;amount:number;date:string;paidAt:string|null;bankLastFour:string|null};
type Report={unsettledAmount:number|null;unsettledOrders:number;unsettledAdjustmentAmount:number|null;paidTotal:number|null;processingTotal:number|null;payments:Payment[];lastSync:string|null;truncated:boolean};
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function TikTokOfficialPayouts({start,end,onSummary,compact=false}:{start:string;end:string;onSummary?:(data:{unsettledAmount:number|null;paidTotal:number|null;processingTotal:number|null}|null)=>void;compact?:boolean}){
 const [data,setData]=useState<Report|null>(null),[loading,setLoading]=useState(false),[syncing,setSyncing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const request=useCallback(async(method:'GET'|'POST')=>{const auth=await supabase?.auth.getSession();const access=auth?.data.session?.access_token;if(!access)throw Error('Please sign in again');const res=await fetch('/api/tiktok/finance/official'+(method==='GET'?`?${new URLSearchParams({start,end})}`:''),{method,headers:{Authorization:`Bearer ${access}`,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?JSON.stringify({start,end}):undefined,cache:'no-store'});const result=await res.json();if(!res.ok)throw Error(result.error||'TikTok payout request failed');return result;},[start,end]);
 const refresh=useCallback(async()=>{if(!start||!end)return;setLoading(true);try{setData(await request('GET'));setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load payouts')}finally{setLoading(false)}},[start,end,request]);
 useEffect(()=>{refresh()},[refresh]);
 useEffect(()=>{onSummary?.(data?{unsettledAmount:data.unsettledAmount,paidTotal:data.paidTotal,processingTotal:data.processingTotal}:null)},[data,onSummary]);
 async function sync(){setSyncing(true);setNotice('');try{const j=await request('POST');setNotice(`${j.unsettled} unsettled transactions and ${j.payments} payment records processed.${j.incomplete?' Narrow the dates for complete coverage.':''}`);await refresh()}catch(e){setError(e instanceof Error?e.message:'TikTok sync failed')}finally{setSyncing(false)}}
 const box:React.CSSProperties={background:'#252832',border:'1px solid #3b4050',borderRadius:13,padding:18};
 return <section className={compact?"":"surface"} style={{padding:compact?"14px 0 0":24,marginTop:compact?0:20}}>
  <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}><div><div className="eyebrow">OFFICIAL TIKTOK FINANCE</div><h2>Estimated settlements & payments</h2><p className="muted">TikTok-reported figures for {start} through {end}, not the flat 6% model.</p></div><button className="outlineBtn" disabled={syncing||loading} onClick={sync}>{syncing?'Syncing…':'↻ Sync TikTok payouts'}</button></div>
  {error&&<div className="alertBox" role="alert">{error}</div>}{notice&&<p className="muted" role="status">{notice}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,margin:'18px 0'}}>
   <div style={box}><div className="muted">TikTok estimated unsettled</div><strong style={{fontSize:25}}>{fmt(data?.unsettledAmount??null)}</strong><div className="muted" style={{fontSize:12}}>{data?.unsettledOrders??0} unique orders</div></div>
   <div style={box}><div className="muted">TikTok payments marked Paid</div><strong style={{fontSize:25}}>{fmt(data?.paidTotal??null)}</strong><div className="muted" style={{fontSize:12}}>Transferred by TikTok, not bank-verified</div></div>
   <div style={box}><div className="muted">TikTok payments processing</div><strong style={{fontSize:25}}>{fmt(data?.processingTotal??null)}</strong><div className="muted" style={{fontSize:12}}>Pending transfer</div></div>
  </div>
  {data?.unsettledAdjustmentAmount!=null&&<p className="muted">Other unsettled adjustments reported separately: {fmt(data.unsettledAdjustmentAmount)}.</p>}
  <p className="muted" style={{fontSize:12}}>Unsettled estimates use order creation dates; payments use their initiation dates. These totals are different groups, not amounts to add together. Paid amounts may combine multiple streams. Compare them with Chase deposits below. {data?.lastSync?`Last imported: ${new Date(data.lastSync).toLocaleString()}.`:'No official data imported yet.'}</p>
  {data?.truncated&&<div className="alertBox">Record limit reached. Narrow the selected dates for complete figures.</div>}
  {data?.payments?.length?<div style={{overflowX:'auto'}}><table className="dataTable" style={{width:'100%'}}><thead><tr><th>Payment initiated</th><th>Status</th><th>Account</th><th>Amount</th></tr></thead><tbody>{data.payments.map(p=><tr key={p.id}><td>{new Date(p.date).toLocaleDateString()}</td><td>{p.status}</td><td>{p.bankLastFour?'•••• '+p.bankLastFour:'—'}</td><td>{fmt(p.amount)}</td></tr>)}</tbody></table></div>:<p className="muted">No TikTok payment records imported for these dates.</p>}
 </section>;
}
