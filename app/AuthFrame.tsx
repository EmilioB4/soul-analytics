import type {ReactNode} from 'react';
export default function AuthFrame({children}:{children:ReactNode}){
 return <main className="loginScreen authScreen"><div className="loginPanel authPanel"><a className="loginBrand authBrand" href="/" aria-label="Soul Analytics home"><img className="loginLogo" src="/soul-iridescent-logo.jpg" alt=""/><div className="loginLogoCaption">SOUL <small>ANALYTICS</small></div></a>{children}<p className="authFooter">Your workspace. Your accounts.</p></div></main>;
}
