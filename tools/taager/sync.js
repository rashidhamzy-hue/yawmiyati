(async()=>{
if(window.__ymSync){alert('Already running');return;}
window.__ymSync=1;
const S=ms=>new Promise(r=>setTimeout(r,ms));
const MK={sa:'SAU',ae:'ARE',om:'OMN',eg:'EGY',iq:'IRQ'};
const mk=(location.pathname.split('/')[1]||'').toLowerCase();
const country=MK[mk];
if(!country){alert('Open a Taager page for one country first (e.g. taager.com/sa/...)');window.__ymSync=0;return;}
const API='https://merchant.api.taager.com';
let H=null;
const oo=XMLHttpRequest.prototype.setRequestHeader,os=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.setRequestHeader=function(k,v){try{(this.__hh=this.__hh||{})[k]=v;}catch(e){}return oo.apply(this,arguments);};
XMLHttpRequest.prototype.send=function(){try{const h=this.__hh||{};const ks=Object.keys(h);const au=ks.find(k=>/^authorization$/i.test(k));const ti=ks.find(k=>/^taagerid$/i.test(k));if(!(H&&H.done)&&au&&ti&&/^Bearer /.test(h[au])){H=Object.assign({},h,{done:1});}}catch(e){}return os.apply(this,arguments);};
const box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;background:#fff;color:#111;border:3px solid #2e3071;border-radius:12px;padding:12px 14px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:380px';
const txt=document.createElement('div');const stop=document.createElement('button');const dl=document.createElement('button');
stop.textContent='Stop';stop.style.cssText='margin-top:8px;margin-right:6px;padding:6px 14px;border-radius:8px;border:0;background:#c0392b;color:#fff;cursor:pointer';
dl.textContent='Download';dl.style.cssText='margin-top:8px;padding:6px 14px;border-radius:8px;border:0;background:#2e3071;color:#fff;cursor:pointer;display:none';
let stopped=false;stop.onclick=()=>{stopped=true;stop.textContent='Stopping...';};
box.append(txt,stop,dl);document.body.appendChild(box);
const show=h=>{txt.innerHTML='<b>Yawmiyati Taager sync</b> ('+country+')<br>'+h;};
show('Getting ready... If nothing happens in 10 seconds, click any product on this page once (this box stays).');
for(let i=0;i<120&&!(H&&H.done);i++){await S(500);}
if(!(H&&H.done)){show('Could not get ready. Reload the page and try again.');window.__ymSync=0;return;}
const hdr=lang=>{const h={'Accept':'application/json','Accept-Language':lang,'country':country,'platform':'web'};for(const k of Object.keys(H)){if(k==='done')continue;if(/^(authorization|taagerid|version|ui-session-key)$/i.test(k))h[k]=H[k];}return h;};
const get=async(path,lang)=>{for(let t=0;t<3;t++){try{const r=await fetch(API+path,{headers:hdr(lang||'ar')});if(r.status===429){await S(5000);continue;}if(!r.ok)return {__status:r.status};return await r.json();}catch(e){await S(2000);}}return {__status:'network'};};
const ans=prompt('How many products to read? (0 = all products in this country)','0');
if(ans===null){box.remove();window.__ymSync=0;return;}
const limit=Math.max(0,parseInt(ans,10)||0);
const out={source:'taager-merchant-sync',version:3,market:mk,country,started_at:new Date().toISOString(),listing:[],details:{},alternatives:{},errors:[]};
let page=1,seen=0,det=0;
while(!stopped){
const L=await get('/api/products/variants?pageSize=50&page='+page+'&sortBy=introducedAt&sortOrder=descending&query=','en');
if(!Array.isArray(L)){out.errors.push({page,status:L&&L.__status});break;}
if(!L.length)break;
for(const v of L){
if(stopped||(limit&&seen>=limit))break;
seen++;out.listing.push(v);
const pid=v.productId;
if(pid&&!out.details[pid]){
const d=await get('/api/products/'+pid+'/merchant-info','ar');
out.details[pid]=d;det++;
const a=await get('/api/products/'+pid+'/merchant-info/alternatives','en');
out.alternatives[pid]=a;
await S(400+Math.random()*400);
}
show('Products read: '+seen+(limit?' / '+limit:'')+'<br>Details read: '+det+'<br>Page: '+page+(out.errors.length?'<br>Errors: '+out.errors.length:''));
}
if(limit&&seen>=limit)break;
page++;await S(500);
}
out.finished_at=new Date().toISOString();
out.counts={listing:out.listing.length,details:Object.keys(out.details).length};
XMLHttpRequest.prototype.setRequestHeader=oo;XMLHttpRequest.prototype.send=os;
const name='taager-sync-'+mk+'-'+new Date().toISOString().slice(0,10)+'.json';
dl.style.display='inline-block';dl.textContent='Download ('+out.counts.details+' products)';
dl.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out)],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();a.remove();};
show((stopped?'Stopped. ':'Finished. ')+'Products read: '+seen+'. Click Download, then attach the file in Claude.');
stop.textContent='Close';stop.style.background='#1f6f63';stop.onclick=()=>box.remove();
window.__ymSync=0;
})();
