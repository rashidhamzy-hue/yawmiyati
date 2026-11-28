(async()=>{
if(window.__ymSync){alert('Yawmiyati sync is already running in this tab.');return;}
window.__ymSync=1;
const VERSION=5;
const ADMIN='https://yawmiyati-storefront-staging.rashid-hamzy.workers.dev/admin#taager-link';
const S=ms=>new Promise(r=>setTimeout(r,ms));
const MK={sa:'SAU',ae:'ARE',om:'OMN',eg:'EGY',iq:'IRQ'};
const here=(location.pathname.split('/')[1]||'').toLowerCase();
if(!MK[here]){alert('Open a Taager page first (for example taager.com/sa/...).');window.__ymSync=0;return;}
const API='https://merchant.api.taager.com';
const LIST='/'+here+'/explore/products';
let H=null;
const grab=h=>{try{h=h||{};const ks=Object.keys(h);const au=ks.find(k=>/^authorization$/i.test(k));const ti=ks.find(k=>/^taagerid$/i.test(k));if(au&&ti&&/^Bearer /.test(h[au])){H=Object.assign({},h,{done:1});}}catch(e){}};
const SKIP=/auth|token|login|logout|otp|password|wallet|payout|withdraw|payment|bank|transaction|kyc|profile|account|user|phone|email|notification|order/i;
const redact=t=>String(t).replace(/[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/\+?[0-9][0-9 ]{8,}[0-9]/g,'[number]');
const hookWin=w=>{try{if(!w||w.__ymHooked)return;const P=w.XMLHttpRequest&&w.XMLHttpRequest.prototype;if(!P)return;w.__ymHooked=1;w.__ymApi=w.__ymApi||[];const op=P.open,sr=P.setRequestHeader,sd=P.send;P.open=function(m,u){try{this.__u=String(u||'');}catch(e){}return op.apply(this,arguments);};P.setRequestHeader=function(k,v){try{(this.__hh=this.__hh||{})[k]=v;}catch(e){}return sr.apply(this,arguments);};P.send=function(){grab(this.__hh);try{const x=this;if(w.__ymRec&&/merchant\.api\.taager\.com/.test(x.__u)&&!SKIP.test(x.__u.split('?')[0])){x.addEventListener('load',()=>{try{const t=x.responseText||'';if(t.length<300000&&w.__ymApi.length<40){w.__ymApi.push({url:x.__u.replace(/^https:\/\/merchant\.api\.taager\.com/,''),status:x.status,json:JSON.parse(redact(t))});}}catch(e){}});}}catch(e){}return sd.apply(this,arguments);};}catch(e){}};
const oo=XMLHttpRequest.prototype.setRequestHeader,os=XMLHttpRequest.prototype.send,oop=XMLHttpRequest.prototype.open;
hookWin(window);
let frame=null;
const restore=()=>{XMLHttpRequest.prototype.setRequestHeader=oo;XMLHttpRequest.prototype.send=os;XMLHttpRequest.prototype.open=oop;try{window.__ymHooked=0;}catch(e){}if(frame){frame.remove();frame=null;}};
const loadFrame=async(path,rec,maxMs)=>{if(!frame){frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;left:-4000px;top:0;width:1280px;height:1000px;opacity:0;pointer-events:none;border:0';document.body.appendChild(frame);}try{frame.contentWindow.__ymOld=1;}catch(e){}frame.src=path;const t0=Date.now(),cc=path.split('/')[1];let w=null,t1=0;while(Date.now()-t0<maxMs){try{const cw=frame.contentWindow;if(cw&&!cw.__ymOld&&cw.location.origin===location.origin&&cw.location.pathname.indexOf('/'+cc+'/')===0){if(rec&&!cw.__ymRec){cw.__ymRec=1;cw.__ymApi=[];}hookWin(cw);if(!w){w=cw;t1=Date.now();}}}catch(e){if(w)break;}if(w&&!rec&&H)break;if(w&&rec&&Date.now()-t1>1500)break;await S(15);}return w;};
const box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;background:#fff;color:#111;border:3px solid #2e3071;border-radius:12px;padding:12px 14px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:400px';
const txt=document.createElement('div');const stop=document.createElement('button');const dl=document.createElement('button');
const btn='margin-top:8px;margin-right:6px;padding:6px 14px;border-radius:8px;border:0;color:#fff;cursor:pointer;';
stop.textContent='Stop';stop.style.cssText=btn+'background:#c0392b';
dl.textContent='Download';dl.style.cssText=btn+'background:#2e3071;display:none';
let stopped=false;stop.onclick=()=>{stopped=true;stop.textContent='Stopping...';};
box.append(txt,stop,dl);document.body.appendChild(box);
let head='';
const show=h=>{txt.innerHTML='<b>Yawmiyati Taager sync v5</b><br>'+head+h;};
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
const onList=location.pathname.indexOf(LIST)===0;
show('Getting ready...'+(onList?'':'<br>Tip: this works best from taager.com'+LIST+' (Taager\u2019s products page).'));
for(let i=0;i<4&&!H;i++){await S(500);}
if(!H){try{const y=window.scrollY;window.scrollTo(0,document.body.scrollHeight);await S(800);window.scrollTo(0,y);window.dispatchEvent(new Event('focus'));}catch(e){}for(let i=0;i<6&&!H;i++){await S(500);}}
if(!H){show('Getting ready (opening Taager\u2019s products page in the background)...');await loadFrame(LIST,false,20000);for(let i=0;i<20&&!H;i++){await S(500);}}
if(!H){show('Getting ready... Taager has not answered yet. Click any product or scroll this page once (this box stays).'+(onList?'':'<br>Or open taager.com'+LIST+' and click Taager Sync again.'));for(let i=0;i<120&&!H;i++){await S(500);}}
if(!H){show('Could not get ready. Open taager.com'+LIST+', reload it, and click Taager Sync again.');restore();window.__ymSync=0;return;}
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
const INFO=['info','loyalty'];
const INFO_RX=/(info|loyalty|help|faq|polic|shipping|delivery|learn|guide|terms|vip|program|reward|rule|fee|tier)/i;
const readPages=async mk=>{const out=[];const queue=INFO.map(p=>'/'+mk+'/'+p);const done=new Set();
for(let n=0;n<queue.length&&n<10&&!stopped;n++){const path=queue[n];if(done.has(path))continue;done.add(path);
show('Reading Taager information pages: <b>'+path+'</b>');
const w=await loadFrame(path,true,25000);if(!w){out.push({path,error:'could not open'});continue;}
let last=-1,same=0,text='';for(let i=0;i<50&&same<6;i++){await S(500);try{text=(w.document.body&&w.document.body.innerText)||'';}catch(e){text='';}if(text.length===last&&text.length>0)same++;else{same=0;last=text.length;}}
let title='',links=[];try{title=w.document.title||'';const as=w.document.querySelectorAll('a[href]');for(const a of as){const u=new URL(a.getAttribute('href'),w.location.href);if(u.origin===location.origin&&u.pathname.indexOf('/'+mk+'/')===0&&INFO_RX.test(u.pathname)&&!SKIP.test(u.pathname)&&!/products/.test(u.pathname))links.push(u.pathname);}}catch(e){}
links=[...new Set(links)];for(const l of links)if(!done.has(l)&&queue.indexOf(l)<0)queue.push(l);
out.push({path,title,read_at:new Date().toISOString(),text:redact(text).slice(0,60000),links,api:(w.__ymApi||[]).slice(0,40)});}
return out;};
let lastPagesAt=0;
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
if(!stopped&&Date.now()-lastPagesAt>20*3600000){file.pages={};for(const mk of list){if(stopped)break;head='Information pages for <b>'+MK[mk]+'</b><br>';file.pages[mk]=await readPages(mk);}lastPagesAt=Date.now();try{if(frame)await loadFrame(LIST,false,8000);}catch(e){}}
head='';
const msg=await deliver(file);
const tot=file.countries.reduce((s,c)=>s+c.counts.listing,0);
const pg=file.pages?Object.values(file.pages).reduce((s,a)=>s+a.filter(x=>!x.error).length,0):0;
const pgTxt=file.pages?'<br>Information pages read: '+pg+' (shipping, loyalty and others; kept in the file).':'';
if(stopped||!every){show((stopped?'Stopped. ':'Finished. ')+tot+' products listed in '+file.countries.length+' countries.'+pgTxt+'<br>'+msg);break;}
const nextAt=Date.now()+every*3600000;
while(!stopped&&Date.now()<nextAt){show('Finished at '+new Date().toLocaleTimeString()+'. '+tot+' products.<br>'+msg+'<br><br>Automatic mode: next run at '+new Date(nextAt).toLocaleTimeString()+'. Keep this tab open.');await S(30000);}
}while(!stopped);
restore();
stop.textContent='Close';stop.style.background='#1f6f63';stop.onclick=()=>box.remove();
window.__ymSync=0;
})();
