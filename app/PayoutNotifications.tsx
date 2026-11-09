'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';
type Settings={enabled:boolean;tiktok_enabled:boolean;walmart_enabled:boolean;last_checked_at:string|null;last_error:string|null};
type History={platform:string;stage:string;state:string;amount:number;event_date:string;updated_at:string};
export default function PayoutNotifications(){
 const [settings,setSettings]=useState<Settings>({enabled:false,tiktok_enabled:true,walmart_enabled:false,last_checked_at:null,last_error:null});
 const [configured,setConfigured]=useState(false),[webhook,setWebhook]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[userId,setUserId]=useState(''),[walmartReady,setWalmartReady]=useState(false),[history,setHistory]=useState<History[]>([]);
 const request=useCallback(async(path='',body?:unknown)=>{const auth=await supabase?.auth.getSession();const token=auth?.data.session?.access_token;if(!token)throw Error('Sign in to manage payout alerts.');const response=await fetch('/api/notifications/payouts'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Notification request failed.');return data;},[]);
 const load=useCallback(async()=>{try{const data=await request();setConfigured(data.configured);if(data.settings)setSettings(data.settings);setUserId(data.userId);setWalmartReady(data.walmartOwnerConfigured);setHistory(data.history||[]);setError('');}catch(e){setError(e instanceof Error?e.message:'Cannot load notifications.');}finally{setLoading(false);}},[request]);
 useEffect(()=>{void load();},[load]);
 async function action(kind:'save'|'test'|'check'){
  setBusy(true);setError('');setNotice('');try{
   if(kind==='save'){await request('',{enabled:settings.enabled,tiktok_enabled:settings.tiktok_enabled,walmart_enabled:settings.walmart_enabled,...(webhook.trim()?{webhook:webhook.trim()}:{})});setWebhook('');setNotice('Settings saved. Use Check now to establish the initial baseline.');}
   else if(kind==='test'){await request('/test',{});setNotice('Test notification delivered to Discord.');}
   else{const result=await request('/check',{});setNotice([result.notice,typeof result.sent==='number'?`${result.sent} notifications sent.`:'',...(result.errors||[])].filter(Boolean).join(' '));}
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Notification action failed.');}finally{setBusy(false);}
 }
 return <section className="surface settingsPanel"><div className="surfaceHeader"><div><div className="eyebrow">DISCORD NOTIFICATIONS</div><h2>Payout alerts</h2><p className="muted">Platform-reported payment updates, separate from profit estimates.</p></div><span className={`connectBadge ${configured?'connected':''}`}>{configured?'Webhook saved':'Not configured'}</span></div>
 <p className="muted">TikTok: processing and paid payments. Walmart: scheduled settlements and reported payouts. These statuses do not confirm a withdrawable balance or a bank deposit.</p>
 {error&&<div className="alertBox" role="alert">{error}</div>}{notice&&<div className="alertBox" role="status">{notice}</div>}
 <div style={{display:'grid',gap:16,marginTop:18}}><label>Discord webhook URL<input type="password" autoComplete="off" spellCheck={false} value={webhook} onChange={e=>setWebhook(e.target.value)} placeholder={configured?'Saved securely · leave blank to keep it':'https://discord.com/api/webhooks/…'} style={{display:'block',width:'100%',marginTop:8}}/></label><p className="muted" style={{fontSize:12,margin:0}}>Stored encrypted on the server. The saved URL is never displayed. Create it in Discord → channel settings → Integrations → Webhooks.</p>
 <label><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings(s=>({...s,enabled:e.target.checked}))}/> Enable payout notifications</label>
 <label><input type="checkbox" checked={settings.tiktok_enabled} onChange={e=>setSettings(s=>({...s,tiktok_enabled:e.target.checked}))}/> TikTok Shop · processing / paid</label>
 <label><input type="checkbox" checked={settings.walmart_enabled} disabled={!walmartReady} onChange={e=>setSettings(s=>({...s,walmart_enabled:e.target.checked}))}/> Walmart · scheduled / reported sent</label>
 {!walmartReady&&userId&&<p className="muted" style={{fontSize:12}}>To enable your connected Walmart account, set WALMART_OWNER_ID in Vercel to <code style={{wordBreak:'break-all'}}>{userId}</code> and redeploy.</p>}
 <label className="muted"><input type="checkbox" disabled/> Whatnot · unavailable through the current payout API integration</label>
 <div className="settingsActions"><button className="primaryBtn" disabled={busy||loading} onClick={()=>void action('save')}>Save notifications</button><button className="outlineBtn" disabled={busy||!configured||Boolean(webhook.trim())} onClick={()=>void action('test')}>Send test notification</button><button className="outlineBtn" disabled={busy||!configured||!settings.enabled||Boolean(webhook.trim())} onClick={()=>void action('check')}>{busy?'Working…':'Check now'}</button></div>
 <p className="muted" style={{fontSize:12}}>Automatic check: daily at 10:00 UTC when CRON_SECRET is configured in Vercel. Check now also works manually. The first successful check per platform records existing payouts silently; newly observed statuses alert after that. TikTok checks payments created in the last 90 days. Source or delivery failures appear here. Uncertain deliveries are not automatically resent to avoid duplicate messages.</p>
 <p className="muted">Last check: {settings.last_checked_at?new Date(settings.last_checked_at).toLocaleString():'Not checked yet'}{settings.last_error&&<span style={{display:'block'}}>{settings.last_error}</span>}</p>
 {history.length>0&&<div className="tableScroll"><table className="modernTable"><thead><tr><th>Platform</th><th>Status</th><th>Amount</th><th>Delivery</th></tr></thead><tbody>{history.map((row,i)=><tr key={i}><td>{row.platform}</td><td>{row.stage}<div className="muted">{row.event_date}</div></td><td>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(row.amount)}</td><td>{row.state==='baseline'?'Existing · no alert':row.state==='sent'?'Delivered':row.state==='uncertain'?'Check channel / webhook':row.state==='retry'?'Retry pending':'Sending'}</td></tr>)}</tbody></table></div>}
 </div></section>;
}
