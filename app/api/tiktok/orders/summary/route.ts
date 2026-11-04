import {NextRequest,NextResponse} from 'next/server';
import {db,owner} from '../../../../../lib/tiktok';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 try{
  const user=await owner(req.headers.get('authorization'));
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const client=db();
  const {data,error}=await client.from('tiktok_orders').select('order_id,shop_id,status,currency,product_subtotal,created_at,synced_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(1000);
  if(error)return NextResponse.json({error:'Order table missing. Run the bundled tiktok_orders.sql migration.'},{status:503});
  const orders=data||[];
  const payable=orders.filter(o=>!['UNPAID','CANCELLED'].includes(o.status)&&o.currency==='USD'&&o.product_subtotal!==null);
  const total=payable.reduce((a,o)=>a+Number(o.product_subtotal),0);
  return NextResponse.json({orders:orders.length,productSalesSubtotal:Math.round(total*100)/100,currency:'USD',countedOrders:payable.length,latestSync:orders.reduce((a,o)=>o.synced_at&&o.synced_at>a?o.synced_at:a,''),limited:orders.length===1000,recent:orders.slice(0,12).map(o=>({id:o.order_id,status:o.status,subtotal:o.product_subtotal,currency:o.currency,date:o.created_at}))});
 }catch{return NextResponse.json({error:'Order summary unavailable'},{status:503})}
}
