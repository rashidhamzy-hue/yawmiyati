(async()=>{
if(window.__ymSync){alert('Yawmiyati sync is already running in this tab.');return;}
window.__ymSync=1;
const VERSION=4;
const ADMIN='https://yawmiyati-storefront-staging.rashid-hamzy.workers.dev/admin#taager-link';
const S=ms=>new Promise(r=>setTimeout(r,ms));
const MK={sa:'SAU',ae:'ARE',om:'OMN',eg:'EGY',iq:'IRQ'};
const here=(location.pathname.split('/')[1]||'').toLowerCase();
if(!MK[here]){alert('Open a Taager page first (for example taager.com/sa/...).');window.__ymSync=0;return;}
const API='https://merchant.api.taager.com';
let H=null;
const oo=XMLHttpRequest.prototype.setRequestHeader,os=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.setRequestHeader=function(k,v){try{(this.__hh=this.__hh||{})[k]=v;}catch(e){}return oo.apply(this,arguments);};
XMLHttpRequest.prototype.send=function(){try{const h=this.__hh||{};const ks=Object.keys(h);const au=ks.find(k=>/^authorization$/i.test(k));const ti=ks.find(k=>/^taagerid$/i.test(k));if(au&&ti&&/^Bearer /.test(h[au])){H=Object.assign({},h,{done:1});}}catch(e){}return os.apply(this,arguments);};
const restore=()=>{XMLHttpRequest.prototype.setRequestHeader=oo;XMLHttpRequest.prototype.send=os;};
const box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;background:#fff;color:#111;border:3px solid #2e3071;border-radius:12px;padding:12px 14px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:400px';
const txt=document.createElement('div');const stop=document.createElement('button');const dl=document.createElement('button');
const btn='margin-top:8px;margin-right:6px;padding:6px 14px;border-radius:8px;border:0;color:#fff;cursor:pointer;';
stop.textContent='Stop';stop.style.cssText=btn+'background:#c0392b';
dl.textContent='Download';dl.style.cssText=btn+'background:#2e3071;display:none';
let stopped=false;stop.onclick=()=>{stopped=true;stop.textContent='Stopping...';};
box.append(txt,stop,dl);document.body.appendChild(box);
let head='';
const show=h=>{txt.innerHTML='<b>Yawmiyati Taager sync v4</b><br>'+head+h;};
const ansC=prompt('Which countries? Type all, or codes like sa,ae (this page is '+here+').','all');
if(ansC===null){box.remove();restore();window.__ymSync=0;return;}
const list=(/^\s*all\s*$/i.test(ansC)?Object.keys(MK):ansC.toLowerCase().split(/[\s,]+/).filter(c=>MK[c]));
if(!list.length){alert('No valid country codes.');box.remove();restore();window.__ymSync=0;return;}
const ansM=prompt('Mode: type full (read every product in detail, slow) or quick (all prices and stock, details only for new or changed products).','quick');
if(ansM===null){box.remove();restore();window.__ymSync=0;return;}
const quick=!/^\s*full\s*$/i.test(ansM);
const ansA=prompt('Repeat automatically every how many hours while this tab stays open? 0 = run once.','0');
if(ansA===null){box.remove();restore();window.__ymSync=0;return;}
const every=Math.max(0,Math.min(48,parseFloat(ansA)||0));
const ansL=confirm('Send results straight to the Yawmiyati owner page? OK = yes (a window opens; sign in there once and leave it open). Cancel = download a file instead.');
let admin=null;
const openBtn=document.createElement('button');openBtn.textContent='Open owner page';openBtn.style.cssText=btn+'background:#1f6f63;display:none';box.append(openBtn);
openBtn.onclick=()=>{admin=window.open(ADMIN,'ym-admin');if(admin)openBtn.style.display='none';};
if(ansL){admin=window.open(ADMIN,'ym-admin');if(!admin)openBtn.style.display='inline-block';}
let lastAck=null;
window.addEventListener('message',e=>{try{if(admin&&e.source===admin&&e.data&&e.data.type==='ym-taager-ack'){lastAck=e.data;}}catch(x){}});
show('Getting ready... If nothing happens in 10 seconds, click any product on this page once (this box stays).');
for(let i=0;i<120&&!(H&&H.done);i++){await S(500);}
if(!(H&&H.done)){show('Could not get ready. Reload the page and try again.');restore();window.__ymSync=0;return;}
const hdr=(country,lang)=>{const h={'Accept':'application/json','Accept-Language':lang,'country':country,'platform':'web'};for(const k of Object.keys(H)){if(k==='done')continue;if(/^(authorization|taagerid|version|ui-session-key)$/i.test(k))h[k]=H[k];}return h;};
const get=async(country,path,lang)=>{for(let t=0;t<4;t++){try{const r=await fetch(API+path,{headers:hdr(country,lang||'ar')});if(r.status===429){await S(5000*(t+1));continue;}if(r.status===401){return {__status:401};}if(!r.ok)return {__status:r.status};return await r.json();}catch(e){await S(2000);}}return {__status:'network'};};
const fp=v=>JSON.stringify([v&&v.financials,v&&v.lockInfo,v&&v.isPrimary]);
const cacheKey=mk=>'ym_taager_fp_'+mk;
const readCache=mk=>{try{return JSON.parse(localStorage.getItem(cacheKey(mk))||'{}');}catch(e){return {};}};
const writeCache=(mk,c)=>{try{localStorage.setItem(cacheKey(mk),JSON.stringify(c));}catch(e){}};
const runCountry=async(mk,idx)=>{
const country=MK[mk];
const prev=readCache(mk);
const firstQuick=quick&&!Object.keys(prev).length;
const out={market:mk,country,mode:quick&&!firstQuick?'quick':'full',started_at:new Date().toISOString(),listing:[],details:{},alternatives:{},errors:[]};
const next={};
let page=1,seen=0,det=0;
head='Country '+(idx+1)+' of '+list.length+': <b>'+country+'</b> ('+out.mode+')<br>';
while(!stopped){
const L=await get(country,'/api/products/variants?pageSize=50&page='+page+'&sortBy=introducedAt&sortOrder=descending&query=','en');
if(!Array.isArray(L)){if(!(L&&L.__status===400&&page>1))out.errors.push({page,status:L&&L.__status});break;}
if(!L.length)break;
for(const v of L){
if(stopped)break;
seen++;out.listing.push(v);
const sku=v.sku;const f=fp(v);if(sku)next[sku]=f;
const need=out.mode==='full'||!sku||prev[sku]!==f;
const pid=v.productId;
if(need&&pid&&!out.details[pid]){
const d=await get(country,'/api/products/'+pid+'/merchant-info','ar');
if(d&&d.__status){out.errors.push({productId:pid,status:d.__status});}else{out.details[pid]=d;det++;}
const a=await get(country,'/api/products/'+pid+'/merchant-info/alternatives','en');
if(!(a&&a.__status))out.alternatives[pid]=a;
await S(400+Math.random()*400);
}
}
show('Products listed: '+seen+'<br>Read in detail: '+det+'<br>Page: '+page+(out.errors.length?'<br>Errors: '+out.errors.length:''));
page++;await S(500);
}
out.finished_at=new Date().toISOString();
out.complete=!stopped&&!out.errors.some(e=>e.page);
if(out.complete){for(const k of Object.keys(prev))if(!(k in next))delete prev[k];for(const s of Object.keys(next)){const pid=(out.listing.find(x=>x.sku===s)||{}).productId;if(out.mode==='full'||out.details[pid])prev[s]=next[s];}writeCache(mk,prev);}
out.counts={listing:out.listing.length,details:Object.keys(out.details).length};
return out;
};
const deliver=async file=>{
const name='taager-sync-'+(file.countries.length===1?file.countries[0].market:'all')+'-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.json';
dl.style.display='inline-block';dl.textContent='Download file';
dl.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();a.remove();};
if(ansL&&(!admin||admin.closed)){openBtn.style.display='inline-block';show('Click Open owner page (your browser blocked the window), sign in there, then wait.');for(let i=0;i<240&&(!admin||admin.closed)&&!stopped;i++)await S(500);}
if(!admin||admin.closed)return 'Click Download, then upload the file on the owner page.';
lastAck=null;
for(let i=0;i<20&&!lastAck;i++){try{admin.postMessage({type:'ym-taager-sync',file},'https://yawmiyati-storefront-staging.rashid-hamzy.workers.dev');}catch(e){}for(let j=0;j<30&&!lastAck;j++)await S(500);}
if(!lastAck)return 'The owner page did not answer (is it signed in, with Live link on?). Click Download to keep the data.';
if(!lastAck.ok)return 'The owner page could not import: '+String(lastAck.error||'unknown error').slice(0,200)+'. Click Download to keep the data.';
return 'Imported into Yawmiyati: '+String(lastAck.message||'').slice(0,300);
};
do{
const file={source:'taager-merchant-sync',version:VERSION,created_at:new Date().toISOString(),countries:[]};
for(let i=0;i<list.length&&!stopped;i++){file.countries.push(await runCountry(list[i],i));}
head='';
const msg=await deliver(file);
const tot=file.countries.reduce((s,c)=>s+c.counts.listing,0);
if(stopped||!every){show((stopped?'Stopped. ':'Finished. ')+tot+' products listed in '+file.countries.length+' countries.<br>'+msg);break;}
const nextAt=Date.now()+every*3600000;
while(!stopped&&Date.now()<nextAt){show('Finished at '+new Date().toLocaleTimeString()+'. '+tot+' products.<br>'+msg+'<br><br>Automatic mode: next run at '+new Date(nextAt).toLocaleTimeString()+'. Keep this tab open.');await S(30000);}
}while(!stopped);
restore();
stop.textContent='Close';stop.style.background='#1f6f63';stop.onclick=()=>box.remove();
window.__ymSync=0;
})();
