import {payoutSiteUrl} from './payout-brand';
export const ebayScopes=['https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly','https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'];
export function ebayConfig(){
 const clientId=process.env.EBAY_CLIENT_ID,clientSecret=process.env.EBAY_CLIENT_SECRET,ruName=process.env.EBAY_RUNAME;
 const origin=process.env.EBAY_APP_URL||payoutSiteUrl();
 if(!clientId||!clientSecret||!ruName)throw Error('eBay connection is awaiting administrator setup. Configure EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RUNAME.');
 if(!origin)throw Error('Configure EBAY_APP_URL as this website’s production HTTPS address.');
 if(!/^[a-f0-9]{64}$/i.test(process.env.TIKTOK_TOKEN_ENCRYPTION_KEY||''))throw Error('The administrator must configure the existing token encryption key before connecting eBay.');
 const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port)throw Error('EBAY_APP_URL must be a production HTTPS origin.');
 return {clientId,clientSecret,ruName,origin:url.origin};
}
export function ebayAuthorizationUrl(state:string){const {clientId,ruName}=ebayConfig();const url=new URL('https://auth.ebay.com/oauth2/authorize');url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:ruName,scope:ebayScopes.join(' '),state}).toString();return url.toString();}
