import {db} from './tiktok';
import {payoutSiteUrl} from './payout-brand';
export function automationConfig(){
 const origin=payoutSiteUrl(),secret=process.env.CRON_SECRET;
 if(!origin)throw Error('Set PAYOUT_APP_URL to the production HTTPS site address in Vercel, then redeploy.');
 if(!secret||secret.length<16)throw Error('Set CRON_SECRET to at least 16 characters in Vercel, then redeploy.');
 return {origin,secret};
}
export async function configureAutomation(){
 const {origin,secret}=automationConfig();
 const result=await db().rpc('configure_background_automation',{p_origin:origin,p_secret:secret,p_bypass:process.env.VERCEL_AUTOMATION_BYPASS_SECRET||null});
 if(result.error)throw Error('Run supabase/automation_repair.sql in Supabase SQL Editor, then try Start / repair automatic updates again.');
}
export async function queueAutomation(kind:'orders'|'payouts'){
 const result=await db().rpc(kind==='orders'?'invoke_order_auto_sync':'invoke_payout_alert_check');
 if(result.error)throw Error('Could not queue the background request. Run supabase/automation_repair.sql and retry.');
}
