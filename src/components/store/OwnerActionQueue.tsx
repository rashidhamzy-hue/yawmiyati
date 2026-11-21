import type {MarketCode} from "@/lib/store/markets";
import type {AiPolicy,CatalogRow,Recommendation} from "@/lib/store/dashboard-client";
import {summarizeOwnerActions} from "@/lib/store/owner-action-queue";

export function OwnerActionQueue({market,catalog,recommendations,policy}:{
 market:MarketCode;catalog:readonly CatalogRow[]|null;
 recommendations:readonly Recommendation[]|null;policy:AiPolicy|null;
}){
 const view=summarizeOwnerActions(market,catalog,recommendations,policy);
 return <section aria-label="Owner action queue" className="space-y-4 rounded-[1.75rem] border bg-card p-5 shadow-soft sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-xl font-extrabold">What needs your attention</h2>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">
     Actions for the selected market only. This is a read-only operational checklist.</p>
   </div>
   <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
    Release not verified
   </span>
  </div>
  <div className="grid gap-3 md:grid-cols-2">
   {view.actions.map(action=><article key={action.code} className="flex flex-col justify-between gap-4 rounded-2xl border bg-background p-4">
    <div><p className={"text-[11px] font-bold uppercase tracking-wide "+(action.urgency==="review"?"text-amber-700 dark:text-amber-400":"text-muted-foreground")}>
      {action.urgency==="review"?"Review required":"Information"}
     </p>
     <h3 className="mt-1 text-sm font-extrabold">{action.title}</h3>
     <p className="mt-2 text-xs leading-6 text-muted-foreground">{action.explanation}</p>
    </div>
    <a href={action.destination} className="w-fit rounded-lg border px-3 py-2 text-xs font-bold text-primary hover:bg-primary-soft">
     View relevant section
    </a>
   </article>)}
  </div>
 </section>;
}
