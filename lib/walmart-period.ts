export type WalmartPeriod='today'|'yesterday'|'7'|'30'|'90'|'ytd'|'custom'|'all';
export function walmartToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function walmartDateRange(period:WalmartPeriod,start='',end='',now=new Date()){
 const today=walmartToday(now);const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 // Presets end on the last completed New York day, matching common seller reports.
 const previous=new Date(today+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);const yesterday=previous.toISOString().slice(0,10);
 if(period==='today')return {start:today,end:today,label:`Today · ${today}`};
 if(period==='yesterday')return {start:yesterday,end:yesterday,label:`Yesterday · ${yesterday}`};
 if(period==='custom'){if(!valid(start)||!valid(end)||start>end)throw Error('Choose valid start/end dates; start must not exceed end.');return {start,end,label:`${start} – ${end}`};}
 if(period==='all')return {start:'',end:today,label:'All imported dates'};
 if(period==='ytd')return {start:today.slice(0,4)+'-01-01',end:today,label:`${today.slice(0,4)}-01-01 – ${today}`};
 const date=new Date(yesterday+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(Number(period)-1));const first=date.toISOString().slice(0,10);return {start:first,end:yesterday,label:`${first} – ${yesterday}`};
}

export function newYorkMidnight(date:string){
 const target=Date.parse(date+'T00:00:00Z');let guess=target;
 for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);const local=Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));guess=target-(local-guess);}
 return new Date(guess).toISOString();
}
