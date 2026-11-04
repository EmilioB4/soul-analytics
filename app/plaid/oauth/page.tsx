'use client';
import {PlaidLinkFlow} from '../../PlaidBank';
export default function PlaidOAuthReturn(){return <main style={{maxWidth:680,margin:'90px auto',padding:30,color:'#f5f3fa',fontFamily:'system-ui',background:'#17191f',borderRadius:16}}><h1>Soul Analytics · Chase authorization</h1><p>Returning securely from Chase. Do not close this page until authorization completes.</p><PlaidLinkFlow autoResume/></main>}
