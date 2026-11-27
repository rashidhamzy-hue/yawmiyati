(()=>{
if(window.__ymRec){window.__ymRec.panel.style.display='block';return;}
const MAXB=300000,TOTAL=8000000;let used=0;
const SKIP=/auth|login|token|wallet|withdraw|payout|payment|bank|profile|notification|analytics|sentry|google|facebook|tiktok|snap|hotjar|clarity|intercom|firebase/i;
const red=s=>String(s).replace(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/"(access_?token|refresh_?token|id_?token|token|password|phone|phoneNumber|mobile|email|iban|walletBalance|balance)"\s*:\s*"[^"]*"/gi,'"$1":"[x]"').replace(/\+?\b\d{11,15}\b/g,'[num]');
const cap=[];
const add=(o)=>{const body=red(o.body||'').slice(0,MAXB);if(used+body.length>TOTAL)return;used+=body.length;o.body=body;cap.push(o);upd();};
const nf=(self.__next_f||[]).map(x=>x&&x[1]).filter(Boolean).join('');
const nd=(document.getElementById('__NEXT_DATA__')||{}).textContent||'';
const res=performance.getEntriesByType('resource').filter(e=>['fetch','xmlhttprequest'].includes(e.initiatorType)).map(e=>e.name).filter(u=>!SKIP.test(u));
const of=window.fetch;
window.fetch=async function(i,o){const r=await of.apply(this,arguments);try{const url=typeof i==='string'?i:(i&&i.url)||'';if(!SKIP.test(url)){const ct=r.headers.get('content-type')||'';if(/json|text|component/.test(ct)){const hn=o&&o.headers?Object.keys(o.headers instanceof Headers?Object.fromEntries(o.headers):o.headers):[];r.clone().text().then(t=>add({kind:'fetch',method:(o&&o.method)||'GET',url,status:r.status,ct,at:Date.now(),req_header_names:hn,credentials:o&&o.credentials,req_body:o&&typeof o.body==='string'?red(o.body).slice(0,20000):null,body:t})).catch(()=>{});}}}catch(e){}return r;};
const oo=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;
const osh=XMLHttpRequest.prototype.setRequestHeader;XMLHttpRequest.prototype.setRequestHeader=function(k,v){(this.__h=this.__h||{})[k]=/^authorization$/i.test(k)?String(v).split(' ')[0]+' [len '+String(v).length+']':(/token|cookie|key/i.test(k)?'[x]':String(v).slice(0,80));return osh.apply(this,arguments);};XMLHttpRequest.prototype.open=function(m,u){this.__u=u;this.__m=m;return oo.apply(this,arguments);};
XMLHttpRequest.prototype.send=function(bd){const reqb=typeof bd==='string'?red(bd).slice(0,20000):null;this.addEventListener('load',()=>{try{const url=String(this.__u||'');if(!SKIP.test(url)){const ct=this.getResponseHeader('content-type')||'';if(/json|text/.test(ct)&&typeof this.responseText==='string')add({kind:'xhr',method:this.__m,url,status:this.status,ct,at:Date.now(),req_headers:this.__h||{},req_body:reqb,with_credentials:this.withCredentials,body:this.responseText});}}catch(e){}});return os.apply(this,arguments);};
const panel=document.createElement('div');
panel.style.cssText='position:fixed;z-index:2147483647;bottom:12px;left:12px;background:#fff;color:#111;border:3px solid #2e3071;border-radius:12px;padding:12px 14px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:360px';
const t=document.createElement('div');const b=document.createElement('button');
b.textContent='Download recording';b.style.cssText='margin-top:8px;padding:6px 14px;border-radius:8px;border:0;background:#2e3071;color:#fff;cursor:pointer';
const upd=()=>{t.innerHTML='<b>Yawmiyati recorder</b><br>Recording. Now click a product to open it, then: Quantity Discounts, Calculate CPA, the 3 tabs at the bottom, the shop icon.<br>Captured: '+cap.length+' responses ('+Math.round(used/1024)+' KB)';};
b.onclick=()=>{const data={source:'taager-recorder',version:2,page:location.href,recorded_at:new Date().toISOString(),next_f:red(nf).slice(0,3000000),next_data:red(nd).slice(0,1000000),resources:res,captured:cap,html_main:red((document.querySelector('main')||document.body).outerHTML.replace(/<svg[\s\S]*?<\/svg>/g,'<svg/>')).slice(0,1500000)};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='taager-recording-'+(location.pathname.split('/').pop()||'page')+'.json';document.body.appendChild(a);a.click();a.remove();};
panel.append(t,b);document.body.appendChild(panel);upd();
window.__ymRec={panel};
})();
