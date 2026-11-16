// Refuse a mismatched identity instead of displaying a previously saved account.
export async function signInAccount(auth:{signInWithPassword:(credentials:{email:string;password:string})=>Promise<{data:{user:{email?:string}|null};error:{message:string}|null}>;signOut:(options:{scope:'local'})=>Promise<unknown>},email:string,password:string){
 const expected=email.trim().toLowerCase();const {data,error}=await auth.signInWithPassword({email:email.trim(),password});
 if(error)throw Error(error.message);
 if(!data.user?.email||data.user.email.toLowerCase()!==expected){await auth.signOut({scope:'local'});throw Error('The signed-in account did not match. Please sign in again.');}
 return data.user;
}
