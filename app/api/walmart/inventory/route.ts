import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
import {validateInventoryLot} from '../../../../lib/walmart-inventory';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req:NextRequest){
 try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const database=db(),lots:unknown[]=[];
 for(let offset=0;offset<100000;offset+=1000){const {data,error}=await database.from('walmart_inventory_lots').select('external_id,data,updated_at').eq('owner_id',user.id).order('external_id').range(offset,offset+999);if(error)return NextResponse.json({error:'Inventory database setup is required. Run supabase/walmart_inventory.sql in Supabase SQL Editor.',setupRequired:true},{status:503});lots.push(...(data||[]));if((data||[]).length<1000){const {data:history,error:historyError}=await database.from('walmart_inventory_history').select('id,external_id,reason,changed_at,before_data,after_data').eq('owner_id',user.id).order('changed_at',{ascending:false}).limit(30);if(historyError)throw Error('Could not load inventory change history.');return NextResponse.json({lots,history:history||[]});}}
 throw Error('Inventory exceeds 100,000 lots; no partial totals were returned.');
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Inventory load failed'},{status:502});}
}
export async function POST(req:NextRequest){
 try{const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(Number(req.headers.get('content-length')||0)>8*1024*1024)return NextResponse.json({error:'Inventory import exceeds 8 MB.'},{status:413});
 const text=await req.text();if(text.length>8*1024*1024)return NextResponse.json({error:'Inventory import exceeds 8 MB.'},{status:413});
 let input;try{input=JSON.parse(text);}catch{return NextResponse.json({error:'Invalid import request.'},{status:400});}
 if(!Array.isArray(input.lots)||input.lots.length<1||input.lots.length>5000)return NextResponse.json({error:'Send 1–5,000 inventory lots.'},{status:400});
 const ids=new Set<string>();let lots;
 try{lots=input.lots.map((row:unknown,index:number)=>{const lot=validateInventoryLot(row,`Row ${index+1}`);if(ids.has(lot.id))throw Error(`Duplicate lot ID ${lot.id}.`);ids.add(lot.id);return lot;});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid inventory row.'},{status:400});}
 const mode=input.mode==='edit'?'edit':'import';
 if(mode==='edit'&&(lots.length!==1||typeof input.version!=='string'))return NextResponse.json({error:'Edit requires one lot and its current version.'},{status:400});
 const reason=mode==='import'?'CSV snapshot import':String(input.reason||'Manual inventory update').trim().slice(0,300);
 const {error}=await db().rpc('save_walmart_inventory',{p_owner:user.id,p_rows:lots,p_reason:reason,p_expected_version:mode==='edit'?input.version:null});
 if(error){if(error.message.includes('Inventory changed'))return NextResponse.json({error:'Inventory changed in another session. Refresh before saving again.'},{status:409});throw Error(`Inventory save failed: ${error.message}. Check that supabase/walmart_inventory.sql has been run.`);}
 return NextResponse.json({saved:lots.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Inventory save failed'},{status:502});}
}
