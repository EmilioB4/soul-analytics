'use client';
import {useEffect,useRef,useState} from 'react';
import type {EbaySeriesPoint} from '../lib/ebay-series';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const dateLabel=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
export default function EbayGraph({series,ready,loading}:{series:EbaySeriesPoint[];ready:boolean;loading:boolean}){
 const svgRef=useRef<SVGSVGElement>(null),[viewWidth,setViewWidth]=useState(900);
 const [metric,setMetric]=useState<'sales'|'profit'>('sales'),[index,setIndex]=useState<number|null>(null);
 const selected=index===null?series.length-1:Math.min(index,series.length-1),values=series.map(p=>p[metric]),valid=values.filter((v):v is number=>v!==null),available=ready&&valid.length>0;
 const lower=Math.min(0,...valid),upper=Math.max(1,...valid),span=upper-lower,pad=span*.12,min=lower<0?lower-pad:0,max=upper+pad,width=viewWidth,height=260,left=68,right=20,top=18,bottom=36;
 const x=(i:number)=>series.length===1?(left+width-right)/2:left+i/(series.length-1)*(width-left-right),y=(value:number)=>top+(max-value)/(max-min)*(height-top-bottom);
 const segments:{i:number;v:number}[][]=[];let segment:{i:number;v:number}[]=[];values.forEach((v,i)=>{if(v===null){if(segment.length)segments.push(segment);segment=[];}else segment.push({i,v});});if(segment.length)segments.push(segment);
 const selectedValue=series[selected]?.[metric];
 useEffect(()=>{const element=svgRef.current;if(!element)return;const resize=()=>setViewWidth(Math.max(360,Math.min(900,element.clientWidth)));resize();const observer=new ResizeObserver(resize);observer.observe(element);return()=>observer.disconnect();},[available]);
 return <section className="surface ebayGraph"><div className="ebayGraphHeader"><div><div className="eyebrow">PERFORMANCE</div><h2>Sales &amp; profit trend</h2></div><div className="ebayGraphSwitch" aria-label="Graph measure">{(['sales','profit'] as const).map(m=><button key={m} className={metric===m?'primaryBtn':'outlineBtn'} aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m==='sales'?'Sales':'Estimated profit'}</button>)}</div></div>
 {loading?<div className="ebayGraphEmpty" role="status">Loading trend…</div>:!available?<div className="ebayGraphEmpty">{!ready?'Sync eBay to see your daily performance.':'Complete the accounting review to show estimated profit.'}</div>:<>
 <div className="ebayGraphReadout" aria-live="polite"><span>{series[selected]?dateLabel(series[selected].date):''}</span><strong>{selectedValue==null?'Needs review':money(selectedValue)}</strong><span className="muted">{metric==='sales'?'Sales before refunds':'Estimated profit'}</span></div>
 <svg ref={svgRef} className={'ebayTrend '+(metric==='profit'?'profit':'sales')} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={metric==='sales'?'Daily eBay sales before refunds':'Daily estimated eBay profit'} onPointerMove={e=>{const box=e.currentTarget.getBoundingClientRect(),position=(e.clientX-box.left)/box.width*width;setIndex(Math.round(Math.max(0,Math.min(1,(position-left)/(width-left-right)))*(series.length-1)));}}>
 <title>{metric==='sales'?'Daily sales':'Daily estimated profit'} for the selected reporting period</title>
 {[0,.5,1].map(r=>{const value=min+(max-min)*r;return <g key={r}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className="ebayGridLine"/><text x={left-12} y={y(value)+4} textAnchor="end" className="ebayAxis">{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value)}</text></g>;})}
 {min<0&&<line x1={left} x2={width-right} y1={y(0)} y2={y(0)} className="ebayZeroLine"/>}
 {segments.map((s,i)=><polyline key={i} points={s.map(p=>`${x(p.i)},${y(p.v)}`).join(' ')} fill="none" className="ebayTrendLine"/>)}
 {selectedValue!=null&&<><line x1={x(selected)} x2={x(selected)} y1={top} y2={height-bottom} className="ebayCursor"/><circle cx={x(selected)} cy={y(selectedValue)} r="5" className="ebayTrendDot"/></>}
 {[...new Set([0,Math.floor((series.length-1)/2),series.length-1])].map(i=><text key={i} x={x(i)} y={height-8} textAnchor={i===0?'start':i===series.length-1?'end':'middle'} className="ebayAxis">{dateLabel(series[i].date)}</text>)}
 </svg>
 {series.length>1&&<input className="ebayGraphScrubber" aria-label="Inspect graph date" type="range" min="0" max={series.length-1} value={selected} onChange={e=>setIndex(Number(e.target.value))}/>}
 <details className="ebayGraphData"><summary>Daily figures</summary><div className="tableScroll"><table className="modernTable"><thead><tr><th>Date</th><th>Sales</th><th>Estimated profit</th></tr></thead><tbody>{series.map(p=><tr key={p.date}><td>{dateLabel(p.date)}</td><td>{money(p.sales)}</td><td>{p.profit===null?'Needs review':money(p.profit)}</td></tr>)}</tbody></table></div></details>
 </>}
 </section>;
}
