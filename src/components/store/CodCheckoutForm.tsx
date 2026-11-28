import {useRef,useState} from "react";
import {Banknote,Lock,PhoneCall,ShieldCheck} from "lucide-react";
import {marketExperience} from "@/lib/store/market-experience";
import type {MarketCode} from "@/lib/store/markets";
import {cityLabel,dialCode,phoneExample,validateCod,type CodErrors,type CodField,type CodForm} from "@/lib/store/cod-checkout";
import {track} from "@/lib/analytics/analytics";
import {chromeCopy} from "@/lib/store/chrome-copy";

const empty:CodForm={name:"",phone:"",city:"",address:"",notes:""};

/**
 * One-page cash-on-delivery form: four required fields, country mobile validation and
 * clear Arabic errors. Values stay in this component only (never stored, never sent)
 * until server-side order creation is authorised.
 */
export function CodCheckoutForm({market,onValidityChange}:{market:MarketCode;onValidityChange?:(valid:boolean)=>void}){
 const copy=chromeCopy(market);
 const [form,setForm]=useState<CodForm>(empty);
 const [touched,setTouched]=useState<Partial<Record<CodField,boolean>>>({});
 const started=useRef(false);
 const errors:CodErrors=validateCod(market,form);
 const show=(f:CodField)=>touched[f]?errors[f]:undefined;
 const update=(f:CodField,v:string)=>{
  if(!started.current){started.current=true;track("checkout_started",{});}
  const next={...form,[f]:v};setForm(next);onValidityChange?.(Object.keys(validateCod(market,next)).length===0);
 };
 const blur=(f:CodField)=>{setTouched(t=>({...t,[f]:true}));const err=validateCod(market,form)[f];if(err)track("checkout_field_error",{field:f});};
 const field="field mt-1.5 block min-h-12 w-full text-base";
 const err=(f:CodField)=>show(f)&&<p id={"cod-"+f+"-error"} role="alert" className="mt-1 text-xs font-bold text-destructive">{show(f)}</p>;
 const described=(f:CodField)=>show(f)?{"aria-invalid":true,"aria-describedby":"cod-"+f+"-error"}:{};
 return <form noValidate onSubmit={e=>e.preventDefault()} aria-labelledby="cod-form-title" className="space-y-4" data-private>
  <h2 id="cod-form-title" className="font-display text-lg font-extrabold">{copy.formTitle}</h2>
  <ul className="grid gap-2 text-xs font-bold text-muted-foreground sm:grid-cols-3">
   <li className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-primary"><Banknote className="h-4 w-4" aria-hidden="true"/>{copy.formCod}</li>
   <li className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-primary"><PhoneCall className="h-4 w-4" aria-hidden="true"/>{copy.formCall}</li>
   <li className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-primary"><ShieldCheck className="h-4 w-4" aria-hidden="true"/>{copy.formNoCard}</li>
  </ul>
  {/* The delivery country is the store's country and cannot be changed: orders for another country go to that country's store. */}
  <div className="rounded-xl border border-border bg-muted/50 px-3.5 py-3" data-delivery-country={market}>
   <p className="flex items-center justify-between gap-3 text-sm"><span className="font-extrabold">{copy.formCountry}</span><span className="inline-flex items-center gap-1.5 font-bold"><Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true"/>{marketExperience[market].regionName}</span></p>
   <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.formCountryFixed(marketExperience[market].regionName)} · {copy.formGiftNote}</p>
  </div>
  <div><label htmlFor="cod-name" className="block text-sm font-extrabold">{copy.formName}</label>
   <input id="cod-name" className={field} name="name" autoComplete="name" value={form.name} onChange={e=>update("name",e.target.value)} onBlur={()=>blur("name")} {...described("name")}/>{err("name")}</div>
  <div><label htmlFor="cod-phone" className="block text-sm font-extrabold">{copy.formPhone}</label>
   <div className="mt-1.5 flex items-stretch gap-2" dir="ltr">
    <span className="grid min-w-16 place-items-center rounded-xl border border-border bg-muted px-3 text-sm font-bold" aria-hidden="true">{dialCode[market]}</span>
    <input id="cod-phone" className="field block min-h-12 w-full text-base" name="tel" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={phoneExample(market)} value={form.phone} onChange={e=>update("phone",e.target.value)} onBlur={()=>blur("phone")} {...described("phone")}/>
   </div>{err("phone")}</div>
  <div><label htmlFor="cod-city" className="block text-sm font-extrabold">{cityLabel[market]}</label>
   <input id="cod-city" className={field} name="city" autoComplete="address-level2" value={form.city} onChange={e=>update("city",e.target.value)} onBlur={()=>blur("city")} {...described("city")}/>{err("city")}</div>
  <div><label htmlFor="cod-address" className="block text-sm font-extrabold">{copy.formAddress}</label>
   <textarea id="cod-address" className={field+" min-h-20 py-3"} name="address" autoComplete="street-address" rows={2} placeholder={copy.formAddressHint} value={form.address} onChange={e=>update("address",e.target.value)} onBlur={()=>blur("address")} {...described("address")}/>{err("address")}</div>
  <div><label htmlFor="cod-notes" className="block text-sm font-bold text-muted-foreground">{copy.formNote}</label>
   <input id="cod-notes" className={field} name="notes" value={form.notes} maxLength={200} onChange={e=>update("notes",e.target.value)} onBlur={()=>blur("notes")} {...described("notes")}/>{err("notes")}</div>
 </form>;
}
