import {NextRequest,NextResponse} from 'next/server';
import {owner,db} from '../../../../lib/tiktok';
export const runtime='nodejs';
export async function POST(req:NextRequest){try{
 const user=await owner(req.headers.get('authorization'));if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const input=await req.json();if(!['product','shipping','packaging'].includes(input.kind)||typeof input.value!=='number'||!Number.isFinite(input.value)||input.value<0||input.value>1000000||Math.abs(input.value*100-Math.round(input.value*100))>0.000001)return NextResponse.json({error:'Enter a valid nonnegative cost.'},{status:400});
 const key=input.kind==='product'?input.sku:input.orderId;if(typeof key!=='string'||!key.trim()||key.length>500)return NextResponse.json({error:'Choose a valid SKU or order.'},{status:400});
 const client=db(),connection=await client.from('ebay_connections').select('account_id').eq('owner_id',user.id).single();if(connection.error||!connection.data)throw Error('Connect your eBay account first.');
 if(input.kind==='product'){const saved=await client.from('ebay_product_costs').upsert({owner_id:user.id,account_id:connection.data.account_id,sku:key,unit_cost:input.value},{onConflict:'owner_id,account_id,sku'});if(saved.error)throw Error('Could not save product cost.');}
 else{if(input.kind==='shipping'&&!['ebay','manual'].includes(input.source))return NextResponse.json({error:'Select eBay labels or manual postage.'},{status:400});const saved=await client.from('ebay_orders').update(input.kind==='packaging'?{packaging_cost:input.value}:{shipping_cost:input.source==='manual'?input.value:null,shipping_mode:input.source}).eq('owner_id',user.id).eq('account_id',connection.data.account_id).eq('order_id',key).select('order_id');if(saved.error||saved.data?.length!==1)throw Error('Order unavailable; shipping cost was not saved.');}
 return NextResponse.json({saved:true});
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not save eBay cost.'},{status:503});}}
