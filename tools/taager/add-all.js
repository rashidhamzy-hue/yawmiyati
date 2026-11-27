(async()=>{
if(window.__ymAdd){alert('Already running');return;}
window.__ymAdd=1;
const S=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.random()*(b-a);
const ans=prompt('Yawmiyati: how many NEW products to add from this page?\nType 0 to only record product facts without adding.','100');
if(ans===null){window.__ymAdd=0;return;}
const max=Math.max(0,parseInt(ans,10)||0);const recordOnly=max===0;
const mk=(location.pathname.split('/')[1]||'xx').toLowerCase();
const LS='ym_taager_facts_'+mk;
let facts={};try{facts=JSON.parse(localStorage.getItem(LS)||'{}');}catch(e){facts={};}
const saveFacts=()=>{try{localStorage.setItem(LS,JSON.stringify(facts));}catch(e){}};
const BAD=/تخسيس|حبوب طبي|مكمل غذائي|دواء|علاج|مبيد|حشرات|صاعق|سلاح|جنسي|تكبير|منشط|سيجار|شيشة|فيب|vape|weapon|pesticide|supplement/i;
const box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:12px;left:12px;background:#fff;color:#111;border:3px solid #1f6f63;border-radius:12px;padding:12px 14px;font:14px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.25);min-width:270px';
const txt=document.createElement('div');const stop=document.createElement('button');const dl=document.createElement('button');
stop.textContent='Stop';stop.style.cssText='margin-top:8px;margin-right:6px;padding:6px 14px;border-radius:8px;border:0;background:#c0392b;color:#fff;cursor:pointer';
dl.style.cssText='margin-top:8px;padding:6px 14px;border-radius:8px;border:0;background:#2e3071;color:#fff;cursor:pointer';
let stopped=false;stop.onclick=()=>{stopped=true;stop.textContent='Stopping...';};
dl.onclick=()=>{const data={source:'taager-card-facts',version:2,market:mk,exported_at:new Date().toISOString(),products:Object.values(facts)};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));a.download='taager-facts-'+mk+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();};
box.append(txt,stop,dl);document.body.appendChild(box);
let added=0,already=0,skipped=0,failed=0,seen=0;const done=new Set();
const show=s=>{dl.textContent='Download facts ('+Object.keys(facts).length+')';txt.innerHTML='<b>Yawmiyati add-all v2</b>'+(recordOnly?' (record only)':'')+'<br>Cards read: '+seen+'<br>Added: '+added+(recordOnly?'':' / '+max)+'<br>Already in store: '+already+'<br>Skipped (risky title): '+skipped+'<br>Not confirmed: '+failed+(s?'<br><i>'+s+'</i>':'');};
const closeP=async b=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await S(250);if(b.getAttribute('data-state')==='open'){b.click();await S(250);}};
const keyOf=b=>{const c=b.closest('div.flex.size-full')||b.parentElement;const a=c&&c.querySelector('a[id^="product-"]');return [a?a.id.replace(/-(image|title)-link$/,'').replace(/^product-/,''):null,c];};
const record=(k,c,state)=>{const tl=c.querySelector('a[id$="-title-link"]');const im=c.querySelector('img');const href=tl?tl.href:'';const m=href.match(/\/products\/(\d+)/);const prev=facts[k]||{};facts[k]={taager_key:k,product_id:m?m[1]:null,url:href,title:(c.querySelector('a[id$="-title-link"] p')||{}).textContent||'',image:im?im.src:'',card_text:(c.innerText||'').replace(/\s+\n/g,'\n').slice(0,1500),page:location.pathname,seen_at:new Date().toISOString(),store_state:state||prev.store_state||null};};
let idle=0;show('working...');
while(!stopped&&(recordOnly||added<max)&&idle<3){
const btns=[...document.querySelectorAll('button#store-actions-button')].filter(b=>{const k=keyOf(b)[0];return k&&!done.has(k);});
if(!btns.length){idle++;const all=document.querySelectorAll('button#store-actions-button');if(all.length)all[all.length-1].scrollIntoView({block:'end'});window.scrollBy(0,2000);show('loading more products...');await S(2500);continue;}
idle=0;
for(const b of btns){
if(stopped||(!recordOnly&&added>=max))break;
const [k,card]=keyOf(b);done.add(k);seen++;
const tl=card&&card.querySelector('a[id$="-title-link"] p');const title=tl?tl.textContent.trim():'';
if(recordOnly){record(k,card,null);show();continue;}
if(BAD.test(title)){skipped++;record(k,card,'skipped_risky');show();continue;}
b.scrollIntoView({block:'center'});await S(350);
b.click();
let p=null;for(let i=0;i<20&&!p;i++){await S(150);const id=b.getAttribute('aria-controls');const el=id&&document.getElementById(id);if(el&&el.querySelector('[id="add-to-store-stores.wooCommerce-btn"]'))p=el;}
const ab=p&&p.querySelector('[id="add-to-store-stores.wooCommerce-btn"]');
if(!ab){failed++;record(k,card,null);await closeP(b);show();continue;}
if(ab.disabled){already++;record(k,card,'in_store');await closeP(b);show();continue;}
ab.click();
let ok=false;for(let i=0;i<40&&!ok;i++){await S(200);const x=document.getElementById(b.getAttribute('aria-controls')||'');const y=x&&x.querySelector('[id="add-to-store-stores.wooCommerce-btn"]');ok=!!(y&&y.disabled);}
if(ok)added++;else failed++;
record(k,card,ok?'in_store':null);
await closeP(b);show(title.slice(0,40));
await S(rnd(1200,2600));
}
saveFacts();}
saveFacts();
show(stopped?'Stopped.':'Finished. Click Download facts, then attach the file in Claude.');
stop.textContent='Close';stop.style.background='#1f6f63';stop.onclick=()=>box.remove();
window.__ymAdd=0;
})();
