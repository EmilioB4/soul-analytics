// Only server-controlled deployment configuration can supply notification links.
export function payoutSiteUrl(){
 const value=process.env.PAYOUT_APP_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'');
 if(!value)return null;
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||url.pathname!=='/')return null;return url.origin;}catch{return null;}
}
