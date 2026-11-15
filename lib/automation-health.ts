export type SchedulerState={state:string;scheduled:boolean;queuedAt:string|null;responseAt:string|null;httpStatus:number|null};
export function automationHealthMessage(health:SchedulerState|null,enabled:boolean){
 if(!enabled)return {label:'Off',detail:'Enable this feature or use Start / repair automatic updates.'};
 if(!health)return {label:'Setup required',detail:'Run the automation repair SQL once, then start automatic updates.'};
 const messages:Record<string,[string,string]>={
  off:['Not scheduled','Start / repair automatic updates to create the background job.'],
  waiting:['Awaiting first run','The schedule exists but no background request has been recorded.'],
  queued:['Verifying','A background request is queued; waiting for the server response.'],
  no_response:['No server response','Supabase queued a request but received no response. Check pg_net and site reachability.'],
  unauthorized:['Authorization failed','Background HTTP 401. Repair the saved CRON_SECRET and check Vercel Deployment Protection if access remains blocked.'],
  blocked:['Site access blocked','Background HTTP 403. Check Vercel Deployment Protection and configure its automation bypass secret.'],
  redirect:['Wrong destination','The background URL redirects. Set PAYOUT_APP_URL to the final production HTTPS origin, redeploy and repair.'],
  not_found:['Endpoint not found','Background HTTP 404. Verify the latest deployment and production URL, then repair.'],
  server_error:['Server error','The background endpoint failed. Review platform status below and Vercel function logs.'],
  provider_error:['Platform check failed','The request reached the site, but an import or payout check failed. Review the platform errors below.'],
  invalid_response:['Unexpected response','The URL did not return the expected background API response. Verify the production URL and deployment access.'],
  timed_out:['Request timed out','The background request exceeded its time limit. Check provider/API latency and Vercel logs.'],
  failed:['Network failure','Supabase could not complete the background HTTP request. Check the destination and request logs.'],
  stale:['Background checks stopped','No recent background response was recorded. Repair the schedule and inspect Supabase Cron.'],
  ok:['Background endpoint verified','A scheduled-path request reached the server and completed without a reported error.']
 };
 const [label,detail]=messages[health.state]||['Unknown status','Check the scheduler and platform status.'];return {label,detail};
}
