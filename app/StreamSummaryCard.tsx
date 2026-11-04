'use client';
import {useEffect,useRef,useState} from 'react';

type CardData={start:string;end:string;total:number;paidOrders:number;unitsSold:number;topSellers:{name:string;quantity:number;sales:number;image:string|null}[];topProfitItems?:{skuId:string;name:string;image:string|null;quantity:number;profit:number}[];profitEstimate?:{profit:number|null;partial:boolean;unpricedSkuCount:number;shippingMissingOrders:number};limited:boolean};
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const compactMoney=(n:number)=>usd(n);
const shortDate=(s:string)=>new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function shrink(ctx:CanvasRenderingContext2D,value:string,max:number,initial:number,min=20){let size=initial;do{ctx.font=`700 ${size}px Arial, Helvetica, sans-serif`;if(ctx.measureText(value).width<=max)break;size-=2}while(size>min);return size}
function line(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,opts:{size?:number;color?:string;weight?:number;align?:CanvasTextAlign;maxWidth?:number}={}){const {size=32,color='#f7f7f9',weight=500,align='left',maxWidth}=opts;ctx.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y,maxWidth)}
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,radius:number){const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2)}
// Draw all decorative shapes and icons with Canvas paths so PNG exports never depend on an icon font.
function icon(ctx:CanvasRenderingContext2D,kind:'sales'|'profit'|'units'|'orders',x:number,y:number,scale=1){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#c8d8ee';
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
function clippedText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number,size:number,min=19){
 ctx.font=`600 ${size}px Arial, Helvetica, sans-serif`;
 if(ctx.measureText(value).width<=maxWidth)return {text:value,size};
 while(size>min&&ctx.measureText(value).width>maxWidth){size--;ctx.font=`600 ${size}px Arial, Helvetica, sans-serif`}
 if(ctx.measureText(value).width<=maxWidth)return {text:value,size};
 let shortened=value;while(shortened.length>1&&ctx.measureText(shortened+'…').width>maxWidth)shortened=shortened.slice(0,-1);
 return {text:shortened+'…',size};
}
function slab(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r=25){
 rounded(ctx,x,y,w,h,r);
 const bg=ctx.createLinearGradient(x,y,x+w,y+h);bg.addColorStop(0,'#282930');bg.addColorStop(.55,'#1c1e24');bg.addColorStop(1,'#12141a');
 ctx.fillStyle=bg;ctx.fill();ctx.strokeStyle='rgba(199,205,221,.45)';ctx.lineWidth=1.5;ctx.stroke();
}
function drawCard(ctx:CanvasRenderingContext2D,data:CardData,logo:HTMLImageElement|null,productImages:(HTMLImageElement|null)[]){
 const W=1600,H=900;ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#17191e');bg.addColorStop(.35,'#0a0c11');bg.addColorStop(1,'#14151b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 glow(ctx,0,0,'rgba(100,174,255,.16)',550);glow(ctx,1600,850,'rgba(191,132,235,.13)',650);
 // Iridescent foil and collectible-slab motifs inspired by Soul's banner.
 ctx.save();ctx.lineCap='round';let foil=ctx.createLinearGradient(0,0,480,210);foil.addColorStop(0,'#9bcfff');foil.addColorStop(.43,'#d8aafd');foil.addColorStop(.8,'#ffe5bd');foil.addColorStop(1,'#90ddf8');
 for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(-80,210-j*28);ctx.bezierCurveTo(55,82-j*18,220,16-j*15,420,-90-j*9);ctx.strokeStyle=foil;ctx.lineWidth=j===0?8:2;ctx.globalAlpha=j===0?.31:.62;ctx.stroke()}ctx.restore();
 ctx.save();ctx.translate(1600,900);ctx.rotate(Math.PI);for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(-70,155-j*17);ctx.bezierCurveTo(90,65-j*10,190,-25-j*8,350,-80-j*7);ctx.strokeStyle=foil;ctx.lineWidth=j===0?7:2;ctx.globalAlpha=j===0?.30:.58;ctx.stroke()}ctx.restore();
 // Subtle foil card outlines in the corners; these are decorative, not product photos.
 ctx.save();ctx.translate(1510,38);ctx.rotate(-.30);rounded(ctx,-10,-135,260,235,22);ctx.strokeStyle='rgba(206,208,230,.21)';ctx.lineWidth=4;ctx.stroke();rounded(ctx,9,-113,260,235,22);ctx.strokeStyle='rgba(146,211,251,.24)';ctx.stroke();ctx.restore();
 if(logo){ctx.drawImage(logo,720,4,160,81)}else line(ctx,'soul',800,81,{size:56,weight:800,align:'center'});
 line(ctx,'STREAM SUMMARY',800,155,{size:42,weight:700,align:'center',color:'#f5f5f8'});
 const dateLabel=data.start===data.end?shortDate(data.start):`${shortDate(data.start)} — ${shortDate(data.end)}`;
 line(ctx,dateLabel,800,188,{size:25,align:'center',color:'#b6bccd'});
 const metrics=[{label:'GROSS SALES',value:compactMoney(data.total),sub:'Product sales subtotal'},{label:'ESTIMATED PROFIT',value:data.profitEstimate?.profit==null?'Unavailable':compactMoney(data.profitEstimate.profit),sub:data.profitEstimate?.partial?'Partial — costs missing':'6% fee + saved COGS'},{label:'UNITS SOLD',value:String(data.unitsSold),sub:'Eligible imported items'},{label:'ORDERS',value:String(data.paidOrders),sub:'Counted orders'}];
 const x0=73,gap=20,w=(1454-gap*3)/4,y=223,h=221;
 metrics.forEach((m,i)=>{const x=x0+i*(w+gap);slab(ctx,x,y,w,h,26);ctx.save();ctx.shadowColor=i%2?'rgba(188,142,255,.32)':'rgba(108,211,255,.29)';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(x+26,y+1);ctx.lineTo(x+w-26,y+1);ctx.strokeStyle=i%2?'#c5adff':'#a6dfff';ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
 // Icon and label form a left-aligned stack; the amount stays centered below with clear separation.
 icon(ctx,(['sales','profit','units','orders'] as const)[i],x+26,y+22,.68);
 line(ctx,m.label,x+26,y+77,{size:19,weight:700,color:'#e4e6ef',align:'left'});
 const valueSize=shrink(ctx,m.value,w-46,m.value.length>11?47:62,25);
 line(ctx,m.value,x+w/2,y+177,{size:valueSize,weight:700,align:'center'});
 line(ctx,m.sub,x+w/2,y+207,{size:16,color:'#a7aebe',align:'center'});
 });
 // Top-three profitability is by dollar profit for SKUs with complete costs.
 slab(ctx,73,472,1454,352,29);
 line(ctx,'TOP 3 PROFIT ITEMS',111,532,{size:29,weight:700,color:'#f6f6fa'});
 const rows=data.topProfitItems||[];
 for(let i=0;i<3;i++){
  const item=rows[i];const rowY=551+i*83;
  if(i>0){ctx.strokeStyle='rgba(185,190,204,.19)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(112,rowY-6);ctx.lineTo(1484,rowY-6);ctx.stroke()}
  if(!item){if(i===0)line(ctx,'No products with complete sales and COGS for this date range',112,650,{size:26,color:'#aeb7c8'});break}
  line(ctx,String(i+1),135,rowY+49,{size:28,weight:700,color:'#f6f6fa',align:'center'});
  const img=productImages[i];rounded(ctx,184,rowY+2,78,69,12);ctx.save();ctx.clip();ctx.fillStyle='#2b2d35';ctx.fill();if(img){const ratio=Math.min(78/img.width,69/img.height);const dw=img.width*ratio,dh=img.height*ratio;ctx.drawImage(img,184+(78-dw)/2,rowY+2+(69-dh)/2,dw,dh)}ctx.restore();
  const safeName=clippedText(ctx,item.name||'Unnamed product',900,25,19);
  line(ctx,safeName.text,289,rowY+31,{size:safeName.size,weight:600});
  line(ctx,`${item.quantity.toLocaleString()} UNITS SOLD`,289,rowY+61,{size:17,color:'#aeb5c6'});
  line(ctx,usd(item.profit),1473,rowY+36,{size:33,weight:700,align:'right'});
  line(ctx,'EST. PROFIT',1473,rowY+61,{size:15,color:'#a7b0c4',align:'right'});
 }
 line(ctx,'SOUL ANALYTICS',73,873,{size:18,weight:700,color:'#b7bfd0'});
 line(ctx,'SKU estimates exclude shipping allocation · Overall profit may be partial',1527,873,{size:15,align:'right',color:'#a0a8b8'});
}
export default function StreamSummaryCard({data,loading}:{data:CardData|null;loading:boolean}){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let active=true;setReady(false);if(!data)return;const c=canvasRef.current;if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;
 const load=(src:string,cross=false)=>new Promise<HTMLImageElement|null>(resolve=>{const img=new Image();if(cross)img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;});
 (async()=>{const [logo,...productImages]=await Promise.all([load('/soul-wordmark-transparent.png'),...(data.topProfitItems||[]).slice(0,3).map(item=>item.image?load(item.image,true):Promise.resolve(null))]);if(!active)return;try{drawCard(ctx,data,logo,productImages);setReady(true);setError('')}catch(e){setError('Could not render summary card.');}})();return()=>{active=false};},[data]);
 async function download(){const canvas=canvasRef.current;if(!canvas||!ready||!data)return;canvas.toBlob(blob=>{if(!blob){setError('Unable to export PNG.');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`soul-summary-${data.start}${data.start===data.end?'':`-to-${data.end}`}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)},'image/png')}
 return <section className="surface" style={{padding:'24px',marginTop:25}}><div className="surfaceHeader"><div><div className="eyebrow">SHAREABLE PERFORMANCE CARD</div><h2>Stream summary image</h2><p className="muted">Uses the reporting dates selected above. Shows all eligible orders for the selected dates, not just one livestream. Top 3 is ranked by estimated SKU profit before shipping.</p></div><button className="primaryBtn" onClick={download} disabled={!ready||loading||!data}>{ready?'↓ Download PNG':'Preparing card…'}</button></div>
 <canvas ref={canvasRef} width={1600} height={900} aria-label="Stream summary image preview" role="img" style={{width:'100%',height:'auto',display:'block',borderRadius:14,background:'#16181d',border:'1px solid #343947'}}/>
 {error&&<p className="msg">{error}</p>}<p className="muted" style={{fontSize:12,marginBottom:0}}>1600 × 900 PNG · Overall profit estimates use 6% fees, saved COGS and available seller shipping. Top 3 SKU profits exclude unallocated shipping. Missing costs and refunds may change the figures.</p></section>
}
