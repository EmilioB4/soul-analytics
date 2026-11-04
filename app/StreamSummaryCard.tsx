'use client';
import {useEffect,useRef,useState} from 'react';

type CardData={start:string;end:string;total:number;paidOrders:number;unitsSold:number;topSellers:{name:string;quantity:number;sales:number;image:string|null}[];profitEstimate?:{profit:number|null;partial:boolean;unpricedSkuCount:number;shippingMissingOrders:number};limited:boolean};
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const compactMoney=(n:number)=>usd(n);
const shortDate=(s:string)=>new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function shrink(ctx:CanvasRenderingContext2D,value:string,max:number,initial:number,min=20){let size=initial;do{ctx.font=`700 ${size}px Arial, Helvetica, sans-serif`;if(ctx.measureText(value).width<=max)break;size-=2}while(size>min);return size}
function line(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,opts:{size?:number;color?:string;weight?:number;align?:CanvasTextAlign;maxWidth?:number}={}){const {size=32,color='#f7f7f9',weight=500,align='left',maxWidth}=opts;ctx.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y,maxWidth)}
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,radius:number){const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2)}
// Draw all decorative shapes and icons with Canvas paths so PNG exports never depend on an icon font.
function icon(ctx:CanvasRenderingContext2D,kind:'sales'|'profit'|'units'|'orders',x:number,y:number){
 ctx.save();ctx.translate(x,y);ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#c8d8ee';
 if(kind==='sales'){
  for(const [cx,cy] of [[12,30],[12,22],[28,26],[28,18],[28,10]]){ctx.beginPath();ctx.ellipse(cx,cy,9,4,0,0,Math.PI*2);ctx.stroke()}
  ctx.beginPath();ctx.moveTo(3,22);ctx.lineTo(3,30);ctx.bezierCurveTo(3,36,21,36,21,30);ctx.moveTo(19,10);ctx.lineTo(19,26);ctx.moveTo(37,10);ctx.lineTo(37,26);ctx.stroke();
 }else if(kind==='profit'){
  [[5,25,8,14],[18,18,8,21],[31,8,8,31]].forEach(([bx,by,bw,bh])=>{ctx.strokeRect(bx,by,bw,bh)});
 }else if(kind==='units'){
  ctx.beginPath();ctx.moveTo(21,4);ctx.lineTo(39,14);ctx.lineTo(39,33);ctx.lineTo(21,43);ctx.lineTo(3,33);ctx.lineTo(3,14);ctx.closePath();ctx.moveTo(3,14);ctx.lineTo(21,24);ctx.lineTo(39,14);ctx.moveTo(21,24);ctx.lineTo(21,43);ctx.stroke();
 }else{
  ctx.beginPath();ctx.moveTo(4,8);ctx.lineTo(9,8);ctx.lineTo(14,29);ctx.lineTo(35,29);ctx.lineTo(40,14);ctx.lineTo(11,14);ctx.moveTo(16,35);ctx.arc(16,37,2,0,Math.PI*2);ctx.moveTo(31,35);ctx.arc(31,37,2,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
function feather(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number,angle:number,alpha:number){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);ctx.globalAlpha=alpha;
 const fill=ctx.createLinearGradient(-80,-35,105,100);fill.addColorStop(0,'#9dd6ff');fill.addColorStop(.56,'#b6a8fa');fill.addColorStop(1,'#edbadf');
 ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(-90,68);ctx.bezierCurveTo(-55,-25,13,-75,84,-102);ctx.bezierCurveTo(91,-28,53,39,-90,68);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#dddaff';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-108,82);ctx.quadraticCurveTo(2,-14,84,-102);ctx.stroke();ctx.restore();
}
function drawCard(ctx:CanvasRenderingContext2D,data:CardData,logo:HTMLImageElement|null,product:HTMLImageElement|null){
 const W=1600,H=900;ctx.clearRect(0,0,W,H);
 let g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#15171d');g.addColorStop(.54,'#0d1016');g.addColorStop(1,'#181922');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 glow(ctx,75,40,'rgba(112,169,241,.16)',530);glow(ctx,1520,870,'rgba(199,135,222,.15)',540);
 const accent=ctx.createLinearGradient(0,0,W,0);accent.addColorStop(0,'#8fcfff');accent.addColorStop(.46,'#bdaafc');accent.addColorStop(.85,'#f5c4e4');accent.addColorStop(1,'#ffe5bb');
 ctx.lineWidth=2;ctx.strokeStyle=accent;ctx.globalAlpha=.42;ctx.beginPath();ctx.moveTo(0,140);ctx.bezierCurveTo(210,10,245,-30,400,-60);ctx.stroke();ctx.beginPath();ctx.moveTo(1200,930);ctx.bezierCurveTo(1470,860,1490,770,1670,730);ctx.stroke();ctx.globalAlpha=1;
 // Quiet feather accents echo Soul's mark without competing with the content.
 feather(ctx,1506,87,.62,.58,.12);feather(ctx,1570,171,.46,.93,.10);
 feather(ctx,95,840,.50,-2.57,.10);feather(ctx,15,770,.37,-2.28,.08);
 if(logo){ctx.drawImage(logo,680,12,240,116);}
 else{line(ctx,'soul',800,99,{size:70,weight:800,align:'center',color:'#eac8f8'})}
 line(ctx,'STREAM SUMMARY',800,191,{size:33,weight:700,align:'center',color:'#f1f1f5'});
 const dateLabel=data.start===data.end?shortDate(data.start):`${shortDate(data.start)} — ${shortDate(data.end)}`;
 line(ctx,dateLabel,800,231,{size:24,color:'#a9afc0',align:'center'});
 // four primary figures
 const metrics=[{label:'GROSS SALES',value:compactMoney(data.total),sub:'Product sales subtotal'},{label:'ESTIMATED PROFIT',value:data.profitEstimate?.profit==null?'Unavailable':compactMoney(data.profitEstimate.profit),sub:data.profitEstimate?.partial?'Partial — costs missing':'6% fee + saved costs'},{label:'UNITS SOLD',value:String(data.unitsSold),sub:'From imported order items'},{label:'ORDERS',value:String(data.paidOrders),sub:'Counted orders'}];
 const gap=19,w= (1472-gap*3)/4,top=292,h=285;
 metrics.forEach((m,i)=>{const x=64+i*(w+gap);rounded(ctx,x,top,w,h,25);g=ctx.createLinearGradient(x,top,x+w,top+h);g.addColorStop(0,'#242831');g.addColorStop(1,'#171a22');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#454753';ctx.lineWidth=2;ctx.stroke();icon(ctx,(['sales','profit','units','orders'] as const)[i],x+26,top+26);line(ctx,m.label,x+26,top+118,{size:21,color:'#c4c8d4',weight:700});const fs=shrink(ctx,m.value,w-50,m.value.length>11?48:63,27);line(ctx,m.value,x+26,top+192,{size:fs,weight:700,color:'#f9f9fb'});line(ctx,m.sub,x+26,top+241,{size:17,color:'#979eae'});});
 // top seller block
 rounded(ctx,64,612,1472,211,28);g=ctx.createLinearGradient(64,612,1536,823);g.addColorStop(0,'#262932');g.addColorStop(1,'#1b1e27');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#535463';ctx.lineWidth=2;ctx.stroke();
 line(ctx,'TOP SELLER',103,682,{size:23,weight:700,color:'#c2c7d3'});
 const seller=data.topSellers?.[0];if(seller){const name=seller.name||'Unnamed product';const maxW=product?875:1150;const font=shrink(ctx,name,maxW,48,26);line(ctx,name,103,742,{size:font,weight:700,maxWidth:maxW});line(ctx,`${seller.quantity.toLocaleString()} UNITS SOLD`,103,788,{size:22,color:'#b2b9ca'});
 if(product){rounded(ctx,1325,638,178,160,18);ctx.save();ctx.clip();ctx.fillStyle='#fff';ctx.fill();ctx.drawImage(product,1325,638,178,160);ctx.restore();}}
 else {line(ctx,'No eligible product sales in this period',103,752,{size:35,color:'#aeb5c4'});}
 line(ctx,'SOUL ANALYTICS',64,869,{size:17,color:'#8c93a5',weight:700});line(ctx,'Based on imported records · Estimate, not final accounting profit',1536,869,{size:16,color:'#8c93a5',align:'right'});
}
export default function StreamSummaryCard({data,loading}:{data:CardData|null;loading:boolean}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let active=true;setReady(false);if(!data)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;
 const load=(src:string,cross=false)=>new Promise<HTMLImageElement|null>(resolve=>{const img=new Image();if(cross)img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});
 (async()=>{const [logo,product]=await Promise.all([load('/soul-wordmark-transparent.png'),data.topSellers?.[0]?.image?load(data.topSellers[0].image,true):Promise.resolve(null)]);if(!active)return;try{drawCard(ctx,data,logo,product);setReady(true);setError('')}catch(e){setError('Could not render summary card.');}})();return()=>{active=false};},[data]);
 async function download(){const canvas=canvasRef.current;if(!canvas||!ready||!data)return;canvas.toBlob(blob=>{if(!blob){setError('Unable to export PNG.');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`soul-summary-${data.start}${data.start===data.end?'':`-to-${data.end}`}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)},'image/png')}
 return <section className="surface" style={{padding:'24px',marginTop:25}}><div className="surfaceHeader"><div><div className="eyebrow">SHAREABLE PERFORMANCE CARD</div><h2>Stream summary image</h2><p className="muted">Uses the reporting dates selected above. A full day or date range includes all imported eligible orders, not just a single livestream.</p></div><button className="primaryBtn" onClick={download} disabled={!ready||loading||!data}>{ready?'↓ Download PNG':'Preparing card…'}</button></div>
 <canvas ref={canvasRef} width={1600} height={900} aria-label="Stream summary image preview" role="img" style={{width:'100%',height:'auto',display:'block',borderRadius:14,background:'#16181d',border:'1px solid #343947'}}/>
 {error&&<p className="msg">{error}</p>}<p className="muted" style={{fontSize:12,marginBottom:0}}>1600 × 900 PNG · Profit is an estimate based on priced sales, 6% assumed fees, saved COGS, and available seller shipping. Missing costs and refunds may change the final result.</p></section>
}
