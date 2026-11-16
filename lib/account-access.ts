// Invalidate in-flight access checks when the session changes. A slower previous
// account must not re-authorize the dashboard after a sign-out or account switch.
export function createAccessGuard(){
 let version=0;
 return {begin(){const request=++version;return ()=>request===version;},invalidate(){version++;}};
}
