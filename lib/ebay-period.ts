export type EbayPeriod='today'|'yesterday'|'7'|'30'|'90'|'ytd';
// eBay rolling ranges include the current New York calendar day.
export function ebayDateRange(period:EbayPeriod,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const shift=(days:number)=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
 if(period==='today')return {start:today,end:today,label:`Today · ${today}`};
 if(period==='yesterday'){const date=shift(-1);return {start:date,end:date,label:`Yesterday · ${date}`};}
 const start=period==='ytd'?today.slice(0,4)+'-01-01':shift(-(Number(period)-1));
 return {start,end:today,label:`${start} – ${today}`};
}
