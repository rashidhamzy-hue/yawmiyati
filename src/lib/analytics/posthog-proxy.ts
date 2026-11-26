/**
 * First-party analytics path: /i/* on our own domain is forwarded to PostHog (US cloud),
 * so ad blockers and network filters that block third-party trackers don't hide visits.
 * Cookies are never forwarded; only the analytics request itself.
 */
export function posthogProxyTarget(url:URL):URL|null{
 if(!url.pathname.startsWith("/i/"))return null;
 const rest=url.pathname.slice(2); // keep leading "/"
 const host=rest.startsWith("/static/")||rest.startsWith("/array/")?"us-assets.i.posthog.com":"us.i.posthog.com";
 return new URL("https://"+host+rest+url.search);
}

export async function proxyPosthog(request:Request,target:URL):Promise<Response>{
 const headers=new Headers();
 for(const name of ["content-type","content-encoding","user-agent","accept","accept-language"]){
  const v=request.headers.get(name);if(v)headers.set(name,v);
 }
 const ip=request.headers.get("cf-connecting-ip");
 if(ip)headers.set("x-forwarded-for",ip);
 const init:RequestInit={method:request.method,headers,redirect:"manual"};
 if(request.method!=="GET"&&request.method!=="HEAD")init.body=await request.arrayBuffer();
 const upstream=await fetch(target.toString(),init);
 const out=new Headers(upstream.headers);
 out.delete("set-cookie");
 return new Response(upstream.body,{status:upstream.status,headers:out});
}
