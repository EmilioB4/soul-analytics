'use client';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import WalmartWfsInventory from './WalmartWfsInventory';
import WalmartFeeSettings from './WalmartFeeSettings';
import {InventoryLot} from '../lib/walmart-inventory';
import {FeeProfile} from '../lib/walmart-fee-reserves';
export default function WalmartWfsPage(){
 const [paceReady,setPaceReady]=useState(false);
 const [catalogSkus,setCatalogSkus]=useState<string[]>([]);
 const [lots,setLots]=useState<InventoryLot[]>([]),[profiles,setProfiles]=useState<FeeProfile[]>([]),[pace,setPace]=useState<Record<string,number>>({}),[costs,setCosts]=useState<Record<string,number>>({}),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void(async()=>{if(!supabase)return;try{const {data:{session}}=await supabase.auth.getSession();if(session){const response=await fetch('/api/walmart/inventory',{headers:{Authorization:`Bearer ${session.access_token}`}});const data=await response.json();if(active&&response.ok)setLots(data.lots.map((r:{data:InventoryLot})=>r.data));}const {data:{user}}=await supabase.auth.getUser();if(!user)return;const start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);const units:Record<string,number>={};for(let offset=0;offset<100000;offset+=1000){const {data,error}=await supabase.from('walmart_sales').select('order_id,line_id,sku,quantity').eq('owner_id',user.id).eq('fulfillment','WFS').gte('order_date',start).order('order_id').order('line_id').range(offset,offset+999);if(error)throw Error('Recent WFS order pace is unavailable.');for(const row of data||[])units[row.sku]=(units[row.sku]||0)+Number(row.quantity);if((data||[]).length<1000)break;if(offset===99000)throw Error('Recent WFS order data exceeds the analytics cap.');}if(active){setPace(units);setPaceReady(true);}const {data,error}=await supabase.from('walmart_product_costs').select('sku,unit_cogs').eq('owner_id',user.id).limit(10000);if(error)throw Error('Saved unit costs are unavailable.');if(active){setPace(units);setCosts(Object.fromEntries((data||[]).map(r=>[r.sku,Number(r.unit_cogs)])));}}catch(e){if(active)setMessage(e instanceof Error?e.message:'Some analytics are unavailable.');}})();return()=>{active=false;};},[]);
 return <div className="inventoryWorkspace">{message&&<div className="alertBox">{message}</div>}<WalmartWfsInventory lots={lots} dashboard pace={pace} unitCosts={costs} feeProfiles={profiles} onSkusLoaded={setCatalogSkus} paceReady={paceReady}/><WalmartFeeSettings skus={[...new Set([...catalogSkus,...Object.keys(pace),...lots.map(l=>l.wm_sku).filter(Boolean)])]} onChange={setProfiles}/></div>;
}
