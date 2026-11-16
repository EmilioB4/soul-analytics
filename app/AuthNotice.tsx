'use client';
import {useEffect,useState} from 'react';
export type AuthMessage={id:number;title:string;text:string;error?:boolean};
export default function AuthNotice({notice}:{notice:AuthMessage|null}){
 const [dismissed,setDismissed]=useState<number|null>(null);
 useEffect(()=>{setDismissed(null);},[notice?.id]);
 if(!notice||dismissed===notice.id)return null;
 return <aside className="authToastRegion" aria-label="Account notifications"><div className={`authToast ${notice.error?'authToastError':''}`} role={notice.error?'alert':'status'} aria-atomic="true"><span className="authToastIcon" aria-hidden="true">{notice.error?'!':'✓'}</span><div className="authToastContent"><strong>{notice.title}</strong><p>{notice.text}</p></div><button className="authToastClose" type="button" aria-label="Dismiss notification" onClick={()=>setDismissed(notice.id)}>×</button></div></aside>;
}
