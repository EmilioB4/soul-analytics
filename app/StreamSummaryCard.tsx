'use client';
import {useEffect,useRef,useState} from 'react';

type TopProduct={skuId:string;name:string;image:string|null;quantity:number;profit:number};
type CardData={start:string;end:string;total:number;paidOrders:number;unitsSold:number;topSellers:{name:string;quantity:number;sales:number;image:string|null}[];topProfitItems?:TopProduct[];profitEstimate?:{profit:number|null;partial:boolean;unpricedSkuCount:number;shippingMissingOrders:number};payoutEstimate?:{expected:number;assumedFee:number;recordedShipping:number;missingShippingOrders:number;settledOrderAmount:number|null;settledOrderCount:number;unsettledOrderCount:number;actualBankPayout:number|null;partial:boolean};limited:boolean};
type Theme={id:string;label:string;color:string;soft:string};
const THEMES:Theme[]=[
 {id:'iris',label:'Iris',color:'#B38BFF',soft:'#7757D6'},
 {id:'sky',label:'Sky',color:'#7ACDFF',soft:'#338DBB'},
 {id:'aqua',label:'Aqua',color:'#7DE2D5',soft:'#299E9D'},
 {id:'blush',label:'Blush',color:'#EEB2E3',soft:'#BA6BBD'},
 {id:'champagne',label:'Champagne',color:'#F5DDAF',soft:'#B7925C'},
 {id:'mono',label:'Mono',color:'#D7DCE7',soft:'#697688'}
];
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const date=(s:string)=>new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function rgba(hex:string,a:number){const h=hex.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`}
function txt(ctx:CanvasRenderingContext2D,s:string,x:number,y:number,size:number,color='#F9FAFC',weight=500,align:CanvasTextAlign='left') {ctx.font=`${weight} ${size}px Inter, Arial, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y)}
function fit(ctx:CanvasRenderingContext2D,s:string,max:number,size:number){let text=s;ctx.font=`600 ${size}px Inter, Arial, sans-serif`;while(ctx.measureText(text).width>max&&text.length>2){text=text.slice(0,-2)+'…'}return text}
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,a:number){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(color,a));g.addColorStop(.46,rgba(color,a*.24));g.addColorStop(1,rgba(color,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function draw(ctx:CanvasRenderingContext2D,data:CardData,theme:Theme,logo:HTMLImageElement|null,images:(HTMLImageElement|null)[]){
 const W=1600,H=900;ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#090A10');bg.addColorStop(.56,'#090A12');bg.addColorStop(1,'#10111B');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 glow(ctx,1450,50,600,theme.color,.27);glow(ctx,40,800,600,theme.soft,.15);glow(ctx,1600,840,420,theme.soft,.13);
 // A subtle editorial texture, not decorative frames or glossy card borders.
 ctx.strokeStyle='rgba(255,255,255,.027)';ctx.lineWidth=1;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(1100+i*65,0);ctx.lineTo(870+i*65,900);ctx.stroke()}
 if(logo){const aspect=logo.width/logo.height;const w=243,h=w/aspect;ctx.drawImage(logo,78,55,w,h)}else txt(ctx,'SOUL ANALYTICS',82,108,29);
 const range=data.start===data.end?date(data.start):`${date(data.start)} — ${date(data.end)}`;
 txt(ctx,range,1514,98,24,'#AEB3C0',500,'right');
 txt(ctx,'Stream Summary',80,259,78,'#F9FAFB',750);
 const metrics=[
  {label:'GROSS SALES',value:usd(data.total)},
  {label:'EST. PROFIT',value:data.profitEstimate?.profit==null?'—':usd(data.profitEstimate.profit)},
  {label:'ORDERS',value:String(data.paidOrders)},
  {label:'UNITS SOLD',value:String(data.unitsSold)}
 ];
 const positions=[80,474,868,1210];const rightBound=[437,831,1172,1510];
 metrics.forEach((m,i)=>{const x=positions[i];if(i>0){ctx.strokeStyle='rgba(200,205,225,.32)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x-34,331);ctx.lineTo(x-34,456);ctx.stroke()}
 txt(ctx,m.label,x,357,21,'#BFC3CE',600);let s=61;ctx.font=`700 ${s}px Inter, Arial, sans-serif`;while(ctx.measureText(m.value).width>(rightBound[i]-x-8)&&s>34){s-=2;ctx.font=`700 ${s}px Inter, Arial, sans-serif`}
 txt(ctx,m.value,x,430,s,i===1?theme.color:'#F9FAFC',750);
 });
 txt(ctx,'Top 3 Profit Items',80,551,41,'#F6F7FB',700);
 const items=data.topProfitItems||[];
 for(let i=0;i<3;i++){
  const y=586+i*82; if(i){ctx.strokeStyle='rgba(195,201,220,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(80,y-13);ctx.lineTo(1520,y-13);ctx.stroke()}
  const p=items[i];if(!p){if(!i)txt(ctx,'No products with complete costs for this period',80,640,23,'#9DA4B4');break}
  txt(ctx,String(i+1),89,y+46,24,'#B1B7C4',600);
  const img=images[i];const ix=148,iy=y,box=66;ctx.fillStyle='#222631';ctx.beginPath();ctx.roundRect(ix,iy,box,box,12);ctx.fill();
  if(img){ctx.save();ctx.beginPath();ctx.roundRect(ix,iy,box,box,12);ctx.clip();const scale=Math.min(box/img.width,box/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,ix+(box-w)/2,iy+(box-h)/2,w,h);ctx.restore()}
  txt(ctx,fit(ctx,p.name,1020,25),238,y+28,25,'#F4F5F8',600);
  txt(ctx,`${p.quantity.toLocaleString('en-US')} units sold`,238,y+57,20,'#A9B0BE');
  txt(ctx,usd(p.profit),1515,y+40,32,'#F7F8FA',700,'right');
 }
 txt(ctx,'SOUL ANALYTICS',80,861,18,'#9A9FAC',600);
 if(data.profitEstimate?.partial)txt(ctx,'Estimated profit · Some costs unavailable',1515,862,17,'#9298A7',400,'right');
 else txt(ctx,'Estimated profit before product-level shipping allocation',1515,862,17,'#9298A7',400,'right');
}
export default function StreamSummaryCard({data,loading,onClose}:{data:CardData|null;loading:boolean;onClose:()=>void}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);const [ready,setReady]=useState(false);const [error,setError]=useState('');
 const [themeId,setThemeId]=useState('iris');const [custom,setCustom]=useState<string|null>(null);
 useEffect(()=>{try{const saved=localStorage.getItem('soul-summary-theme');if(saved){const v=JSON.parse(saved);if(typeof v.id==='string'&&(v.id==='custom'||THEMES.some(t=>t.id===v.id)))setThemeId(v.id);if(typeof v.custom==='string'&&/^#[\da-f]{6}$/i.test(v.custom))setCustom(v.custom)}}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem('soul-summary-theme',JSON.stringify({id:themeId,custom}))}catch{}},[themeId,custom]);
 const theme=themeId==='custom'&&custom?{id:'custom',label:'Custom',color:custom,soft:custom}:THEMES.find(t=>t.id===themeId)||THEMES[0];
 useEffect(()=>{let active=true;setReady(false);if(!data)return;const canvas=canvasRef.current,ctx=canvas?.getContext('2d');if(!ctx)return;
 const load=(src:string,cross=false)=>new Promise<HTMLImageElement|null>(resolve=>{const img=new Image();if(cross)img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src});
 (async()=>{const [logo,...images]=await Promise.all([load('/soul-wordmark-transparent.png'),...(data.topProfitItems||[]).slice(0,3).map(p=>p.image?load(p.image,true):Promise.resolve(null))]);try{await Promise.all([document.fonts.load('700 78px Inter'),document.fonts.load('600 25px Inter')])}catch{}if(!active)return;try{draw(ctx,data,theme,logo,images);setReady(true);setError('')}catch{setError('Could not render summary image.')}})();return()=>{active=false}},[data,themeId,custom]);
 function download(){const c=canvasRef.current;if(!c||!ready||!data)return;try{c.toBlob(blob=>{if(!blob){setError('Unable to export PNG.');return}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`soul-summary-${data.start}${data.start===data.end?'':`-to-${data.end}`}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)},'image/png')}catch{setError('Image export failed. Check product image permissions.')}}
 return <div className="shareModalBackdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
 <section className="shareModal" role="dialog" aria-modal="true" aria-labelledby="shareModalTitle">
  <div className="shareModalHeader"><div><h2 id="shareModalTitle">Share PNL</h2><p>Choose a Soul theme, then download your summary</p></div><button type="button" className="shareModalClose" onClick={onClose} aria-label="Close summary">×</button></div>
  <div className="shareModalImage"><canvas ref={canvasRef} width={1600} height={900} role="img" aria-label="Stream Summary image preview"/></div>
  <div style={{padding:'14px 2px 5px'}}><div style={{fontSize:11,fontWeight:700,letterSpacing:'1.3px',opacity:.72,marginBottom:10}}>TEMPLATE THEME</div>
   <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
    {THEMES.map(t=><button key={t.id} type="button" aria-pressed={themeId===t.id} onClick={()=>setThemeId(t.id)} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',borderRadius:10,border:themeId===t.id?`1px solid ${t.color}`:'1px solid rgba(155,160,175,.24)',background:themeId===t.id?rgba(t.color,.12):'rgba(130,140,165,.05)',color:'inherit',fontSize:12,fontWeight:600,cursor:'pointer'}}><span style={{display:'inline-block',width:14,height:14,borderRadius:'50%',background:t.color,boxShadow:themeId===t.id?`0 0 10px ${rgba(t.color,.5)}`:'none'}}/>{t.label}</button>)}
    <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,border:themeId==='custom'?'1px solid #B7B9C6':'1px solid rgba(155,160,175,.24)',fontSize:12,fontWeight:600,cursor:'pointer'}}>Custom <input aria-label="Choose a custom accent color" type="color" value={custom||'#A98AFF'} onChange={e=>{setCustom(e.target.value);setThemeId('custom')}} style={{width:28,height:25,padding:0,border:0,background:'transparent',cursor:'pointer'}}/></label>
   </div>
  </div>
  {error&&<p className="msg" role="alert">{error}</p>}
  <div className="shareModalFooter"><span>Accent colors affect the exported card only.</span><div className="shareModalActions"><button className="outlineBtn" onClick={onClose}>Close</button><button className="sharePnlBtn" onClick={download} disabled={!ready||loading||!data}>{!ready?'Preparing…':'↓ Download PNG'}</button></div></div>
 </section></div>
}
