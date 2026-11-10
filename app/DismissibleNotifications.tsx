'use client';
import {useState} from 'react';
type Item={id:string;title:string;message:string;error?:boolean};
export default function DismissibleNotifications({items}:{items:Item[]}){
 const [dismissed,setDismissed]=useState<Record<string,string>>({});
 const active=items.filter(item=>item.message&&dismissed[item.id]!==item.message);
 if(!active.length)return null;
 return <aside aria-label="Notifications" style={{position:'fixed',right:20,bottom:20,width:'min(420px, calc(100vw - 40px))',maxHeight:'70vh',overflowY:'auto',zIndex:1000,display:'grid',gap:10}}><div style={{display:'flex',justifyContent:'flex-end'}}><button className="outlineBtn" style={{padding:'6px 12px',background:'var(--panel, #171b25)'}} onClick={()=>setDismissed(Object.fromEntries(items.map(item=>[item.id,item.message])))}>Dismiss all</button></div>{active.map(item=><div role={item.error?'alert':'status'} key={item.id} style={{padding:16,border:'1px solid var(--border)',borderLeft:`3px solid ${item.error?'#e9a3ad':'#7be9ef'}`,borderRadius:12,background:'var(--panel, #171b25)',boxShadow:'0 10px 36px #0006',overflowWrap:'anywhere'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><strong>{item.title}</strong><button type="button" aria-label={`Dismiss ${item.title}`} className="outlineBtn" style={{padding:'2px 9px',fontSize:19}} onClick={()=>setDismissed(current=>({...current,[item.id]:item.message}))}>×</button></div>{item.message.length>180?<details style={{marginTop:8}}><summary style={{cursor:'pointer',color:'var(--muted)'}}>{item.message.slice(0,150)}…</summary><p style={{fontSize:13,marginBottom:0}}>{item.message}</p></details>:<p style={{fontSize:13,color:'var(--muted)',margin:'8px 0 0'}}>{item.message}</p>}</div>)}</aside>;
}
