'use client';
import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';

type Sale={orderId:string;date:string|null;status:string;quantity:number;unitPrice:number|null;subtotal:number|null;currency:string;allocatedCogs?:number|null;estimatedProfit?:number|null;costMethod?:'FIFO'|'Fixed'|'Missing'};
type Product={shopId:string;skuId:string;name:string;variant:string;image:string|null;quantity:number;sales:number|null;unitCost:number|null;currency:string;orders:Sale[]};
type Props={products:Product[]};
const money=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
const roundUp=(number:number)=>Math.ceil((number-0.00000001)*100)/100;
const styles={panel:{background:'var(--surface, #151820)',border:'1px solid var(--border, #31343c)',borderRadius:16,padding:20} as CSSProperties,secondary:{color:'var(--muted, #a7a9b4)'} as CSSProperties};
export default function AuctionAnalytics({products}:Props){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[productId,setProductId]=useState(''),[selectorOpen,setSelectorOpen]=useState(false);
 const [costOverride,setCostOverride]=useState<string|null>(null),[shipping,setShipping]=useState('0'),[targetMargin,setTargetMargin]=useState(20);
 const available=useMemo(()=>products.filter(p=>p.currency==='USD'&&p.orders.length>0),[products]);
 const visible=available.filter(p=>(p.name+' '+p.variant+' '+p.skuId).toLowerCase().includes(query.toLowerCase())).slice(0,40);
 const product=available.find(p=>`${p.shopId}::${p.skuId}`===productId)||available[0];
 const id=product?`${product.shopId}::${product.skuId}`:'';
 useEffect(()=>{setCostOverride(null);setShipping('0')},[id]);
 const sales=(product?.orders||[]).filter(o=>o.currency==='USD'&&o.subtotal!==null&&Number.isFinite(o.subtotal));
 const complete=sales.filter(o=>o.estimatedProfit!==null&&o.estimatedProfit!==undefined&&o.allocatedCogs!==null&&o.allocatedCogs!==undefined);
 const profitable=complete.filter(o=>Number(o.estimatedProfit)>=0);
 const losing=complete.filter(o=>Number(o.estimatedProfit)<0);
 const units=sales.reduce((n,o)=>n+o.quantity,0);
 const total=sales.reduce((n,o)=>n+(o.subtotal||0),0);
 const allocatedUnits=complete.reduce((n,o)=>n+o.quantity,0);
 const allocatedCost=complete.reduce((n,o)=>n+Number(o.allocatedCogs),0);
 const derivedCost=product?.unitCost??(allocatedUnits>0?allocatedCost/allocatedUnits:null);
 const enteredCost=costOverride===null?derivedCost:costOverride.trim()===''?null:Number(costOverride);
 const validCost=enteredCost!==null&&Number.isFinite(enteredCost)&&enteredCost>=0;
 const validShipping=shipping.trim()!==''&&Number.isFinite(Number(shipping))&&Number(shipping)>=0;
 const breakEven=validCost&&validShipping?(Number(enteredCost)+Number(shipping))/0.94:null;
 const target=validCost&&validShipping?(Number(enteredCost)+Number(shipping))/(0.94-targetMargin/100):null;
 const overall=complete.reduce((n,o)=>n+Number(o.estimatedProfit),0);
 return <section style={{marginTop:22,minWidth:0,maxWidth:'100%'}}>
 <button type="button" className="outlineBtn" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="soul-auction-analytics" style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',fontWeight:700}}><span>Sale Price &amp; Auction Analytics <span style={{...styles.secondary,fontSize:12,fontWeight:400,marginLeft:8}}>Compare your selling prices and estimated margins</span></span><span aria-hidden="true">{open?'−':'+'}</span></button>
 {open&&<div id="soul-auction-analytics" style={{...styles.panel,marginTop:12,minWidth:0,maxWidth:'100%',boxSizing:'border-box'}}>
 <div style={{marginBottom:18}}><h3 style={{margin:'0 0 5px'}}>Product performance</h3><p style={{...styles.secondary,margin:0,fontSize:13}}>Uses imported sales, FIFO or saved COGS, and the assumed 6% TikTok fee. Auction versus fixed-price sales cannot yet be distinguished.</p></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:12,marginBottom:16,minWidth:0}}>
  <label style={{display:'grid',gap:6,fontSize:13,fontWeight:600,minWidth:0}}>Search products
   <input value={query} onChange={e=>{setQuery(e.target.value);setSelectorOpen(true)}} placeholder="Search product or SKU" style={{padding:11,width:'100%',minWidth:0,boxSizing:'border-box',borderRadius:9,border:'1px solid var(--border, #43434a)',background:'var(--surface, #171920)',color:'inherit'}}/>
  </label>
  <div style={{display:'grid',gap:6,minWidth:0,position:'relative'}}>
   <span style={{fontSize:13,fontWeight:600}}>Product</span>
   <button type="button" aria-label="Choose a product" aria-expanded={selectorOpen} aria-haspopup="listbox" onClick={()=>setSelectorOpen(v=>!v)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',minWidth:0,maxWidth:'100%',boxSizing:'border-box',padding:'7px 10px',height:48,borderRadius:9,border:'1px solid var(--border, #43434a)',background:'var(--surface, #171920)',color:'inherit',textAlign:'left',cursor:'pointer'}}>
    {product?.image?<img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" style={{width:32,height:32,flexShrink:0,objectFit:'contain',borderRadius:6,background:'#fff'}}/>:<span style={{width:32,height:32,flexShrink:0,display:'grid',placeItems:'center',borderRadius:6,background:'var(--card, #232635)'}}>◈</span>}
    <span style={{display:'block',flex:'1 1 0',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,fontWeight:600}}>{product?.name||'Select a product'}</span>
    <span aria-hidden="true" style={{flexShrink:0,opacity:.7,fontSize:13}}>{selectorOpen?'▴':'▾'}</span>
   </button>
   {selectorOpen&&<div role="listbox" aria-label="Products" style={{position:'absolute',top:'100%',left:0,right:0,marginTop:6,zIndex:40,boxSizing:'border-box',maxHeight:280,overflowY:'auto',overflowX:'hidden',border:'1px solid var(--border, #43434a)',borderRadius:10,background:'var(--surface, #171920)',boxShadow:'0 16px 38px rgba(0,0,0,.38)'}}>
    {visible.length===0?<div style={{padding:13,...styles.secondary,fontSize:13}}>No matching products.</div>:visible.map(p=>{const selected=`${p.shopId}::${p.skuId}`===id;return <button key={`${p.shopId}::${p.skuId}`} type="button" role="option" aria-selected={selected} onClick={()=>{setProductId(`${p.shopId}::${p.skuId}`);setSelectorOpen(false)}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',minWidth:0,boxSizing:'border-box',border:0,borderBottom:'1px solid var(--border, #31343c)',background:selected?'var(--card, #242936)':'transparent',color:'inherit',textAlign:'left',padding:'9px 11px',cursor:'pointer'}}>
     {p.image?<img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" style={{width:39,height:39,objectFit:'contain',flexShrink:0,borderRadius:7,background:'#fff'}}/>:<span style={{width:39,height:39,flexShrink:0,display:'grid',placeItems:'center',borderRadius:7,background:'var(--card, #242936)'}}>◈</span>}
     <span style={{flex:'1 1 0',minWidth:0,display:'grid',gap:3}}><span style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={p.name}>{p.name}</span><span style={{...styles.secondary,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.variant||p.skuId}</span></span>
     {selected&&<span aria-hidden="true" style={{flexShrink:0,color:'#8acdec'}}>✓</span>}
    </button>})}
   </div>}
  </div>
 </div>
 {!product?<p style={styles.secondary}>Import orders to analyze selling prices.</p>:<>
 <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:17}}>{product.image&&<img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" style={{width:55,height:55,objectFit:'contain',borderRadius:9,background:'#fff'}}/>}<div><strong>{product.name}</strong><div style={{...styles.secondary,fontSize:12}}>{product.variant||product.skuId}</div></div></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginBottom:22}}>{[{label:'Average sold price',value:units?money(total/units):'—'},{label:'Highest unit price',value:sales.length?money(Math.max(...sales.filter(s=>s.unitPrice!==null).map(s=>Number(s.unitPrice)))):'—'},{label:'Lowest unit price',value:sales.some(s=>s.unitPrice!==null)?money(Math.min(...sales.filter(s=>s.unitPrice!==null).map(s=>Number(s.unitPrice)))):'—'},{label:'Est. profit on priced sales',value:complete.length?money(overall):'—'},{label:'Profitable sale lines',value:`${profitable.length} / ${complete.length}`},{label:'Losing sale lines',value:`${losing.length} / ${complete.length}`}].map(x=><div key={x.label} style={{background:'var(--card, #1b1f2a)',border:'1px solid var(--border, #333743)',borderRadius:12,padding:14}}><small style={styles.secondary}>{x.label}</small><div style={{fontSize:20,fontWeight:700,marginTop:7,fontVariantNumeric:'tabular-nums'}}>{x.value}</div></div>)}</div>
 <h3 style={{marginBottom:10}}>Break-even price</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,alignItems:'end'}}><label style={{fontSize:12,display:'grid',gap:6}}>Unit cost ($)<input type="number" min="0" step="0.01" placeholder="Enter COGS" value={costOverride===null?(derivedCost===null?'':String(Number(derivedCost.toFixed(2)))):costOverride} onChange={e=>setCostOverride(e.target.value)} style={{padding:11,borderRadius:8,border:'1px solid var(--border, #43434a)',background:'var(--surface, #171920)',color:'inherit'}}/></label><label style={{fontSize:12,display:'grid',gap:6}}>Your shipping per unit ($)<input type="number" min="0" step="0.01" value={shipping} onChange={e=>setShipping(e.target.value)} style={{padding:11,borderRadius:8,border:'1px solid var(--border, #43434a)',background:'var(--surface, #171920)',color:'inherit'}}/></label><label style={{fontSize:12,display:'grid',gap:6}}>Target margin ({targetMargin}%)<input type="range" min="0" max="50" value={targetMargin} onChange={e=>setTargetMargin(Number(e.target.value))}/></label><div style={{fontSize:12}}><div style={styles.secondary}>Break even</div><strong style={{fontSize:20}}>{breakEven===null?'—':money(roundUp(breakEven))}</strong></div><div style={{fontSize:12}}><div style={styles.secondary}>Target price</div><strong style={{fontSize:20}}>{target===null?'—':money(roundUp(target))}</strong></div></div>
 <p style={{...styles.secondary,fontSize:12}}>For FIFO SKUs, the calculator defaults to the historical average allocated unit cost of available sales; override it to model your next auction. The sale history below uses the actual FIFO allocation for each imported line. Calculator shipping is a scenario input and is not deducted from historical line profits.</p>
 <h3 style={{margin:'22px 0 12px'}}>Sale price history <span style={{...styles.secondary,fontSize:12,fontWeight:400}}>({sales.length} order lines)</span></h3>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:610,borderCollapse:'collapse'}}><thead><tr><th style={{textAlign:'left'}}>Date</th><th style={{textAlign:'left'}}>Order</th><th style={{textAlign:'right'}}>Qty</th><th style={{textAlign:'right'}}>Unit price</th><th style={{textAlign:'right'}}>COGS</th><th style={{textAlign:'right'}}>Est. profit</th></tr></thead><tbody>{sales.slice(0,100).map((o,i)=><tr key={`${o.orderId}-${i}`}><td>{o.date?new Date(o.date).toLocaleDateString('en-US'):'—'}</td><td title={o.orderId}>{o.orderId.length>16?o.orderId.slice(0,12)+'…':o.orderId}</td><td style={{textAlign:'right'}}>{o.quantity}</td><td style={{textAlign:'right'}}>{o.unitPrice===null?'—':money(o.unitPrice)}</td><td style={{textAlign:'right'}}>{o.allocatedCogs==null?'Missing':money(o.allocatedCogs)}</td><td style={{textAlign:'right',fontWeight:700,color:o.estimatedProfit==null?'inherit':o.estimatedProfit<0?'#f090a4':'#91d4b3'}}>{o.estimatedProfit==null?'—':money(o.estimatedProfit)}</td></tr>)}</tbody></table></div>
 {sales.length>100&&<p style={styles.secondary}>Showing latest 100 order lines for this product.</p>}{complete.length<sales.length&&<p style={{...styles.secondary,fontSize:12,marginTop:14}}>{sales.length-complete.length} sale line(s) have missing cost allocation or price and are excluded from profit and loss counts.</p>}
 </>}
 </div>}
 </section>;
}
