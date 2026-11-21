import { useState } from "react";
import { markets, type MarketCode } from "../../lib/store/markets";
import { selectOffers } from "../../lib/store/offer-selection";
import { demoCatalog, demoDate } from "../../lib/store/offer-selection-demo";
import { prepareContent } from "../../lib/store/research-evidence";

export function OfferSelectionDemo({market}: {market: MarketCode}) {
  const [open, setOpen] = useState(false);
  const [approved, setApproved] = useState<string[]>([]);
  const {offers, reportedTotal} = demoCatalog(market);
  const report = selectOffers(market, offers, reportedTotal, demoDate);
  const {currency, minorDigits} = markets[market];
  const amount = (n: number | string | null) => n === null ? "Unknown" : (Number(n) / 10 ** minorDigits).toFixed(minorDigits) + " " + currency;
  return <section className="space-y-3 rounded-xl border p-4">
    <button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide" : "Open"} product selection demo</button>
    {open && <><p>Fictional offers and market evidence. Approvals last for this preview session.</p>
      <p>{report.read} of {reportedTotal ?? "unknown"} offers read · Coverage {report.coverage} · {report.selected.length} families shortlisted</p>
      {report.evaluated.map(row => {
        const {offer} = row;
        const selected = report.selected.includes(row);
        const isApproved = selected && approved.includes(offer.sku);
        const brief = isApproved ? prepareContent(market, [{id: offer.sku, statement: offer.title, source: "Demo catalog", verified: true}], "storefront") : null;
        return <article key={offer.sku} className="space-y-1 border-t py-3">
          <h3><span lang="ar" dir="rtl">{offer.title}</span> · {offer.sku}</h3>
          <p>{offer.category} · {offer.components?.map(p => p.quantity + " × " + p.id).join(" + ") ?? "Unverified contents"}</p>
          <p>Price {amount(offer.economics.price)} · Local delivered comparison {amount(offer.competitor?.deliveredMinor ?? null)} · Expected contribution/order {amount(row.contribution)}</p>
          <p>{row.reasons.length ? "Held · " + row.reasons.join(", ").replaceAll("_", " ") : selected ? "Recommended family offer" : "Alternative pack"}</p>
          <details><summary>Pricing and research evidence</summary>
            <p>Research score {row.score ?? "incomplete"}. Families are ranked by evidence score, then expected contribution.</p>
            <p>Source floor {amount(offer.sellerFloor)} · Product cost {amount(offer.economics.supplierCost)} · Outbound delivery {amount(offer.economics.outboundDelivery)} · Delivered fees {amount(offer.economics.deliveredFees)} · Failed-order return cost {amount(offer.economics.returnCost)} · Acquisition cost {amount(offer.economics.adCost)}</p>
            <p>Assumed delivery rate {(offer.economics.deliveryBps ?? 0) / 100}% · {offer.competitor?.source} · {offer.competitor?.observedAt}</p>
            <ul>{offer.observations.map(o => <li key={o.factor}>{o.factor} · {o.score}/100 · {o.source}</li>)}</ul>
            <p>Offers sharing verified items: {offers.filter(other => other.sku !== offer.sku && other.components?.some(item => offer.components?.some(p => p.id === item.id))).map(other => other.sku).join(", ") || "None recorded"}</p>
          </details>
          {selected && <button onClick={() => setApproved(isApproved ? approved.filter(s => s !== offer.sku) : [...approved, offer.sku])}>{isApproved ? "Undo demo approval" : "Approve for content brief"}</button>}
          {brief && <p>Editorial brief · {brief.locale} · <span lang="ar">{brief.facts[0].statement}</span> · {brief.instructions}</p>}
        </article>;
      })}
    </>}
  </section>;
}
