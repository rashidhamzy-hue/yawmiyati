import { useState } from "react";
import { markets, type MarketCode } from "../../lib/store/markets";
import { selectOffers, type Offer } from "../../lib/store/offer-selection";
import { demoCatalog, demoDate } from "../../lib/store/offer-selection-demo";
import { prepareContent } from "../../lib/store/research-evidence";

function demoApprovalKey(offer: Offer) {
  return "yawmiyati:demo-approval:v1:" + offer.market + ":" + offer.sku;
}

function ProductPagePreview({offer}: {offer: Offer}) {
  const {locale, currency, minorDigits} = markets[offer.market];
  const format = (minor: number) => new Intl.NumberFormat(locale, {style: "currency", currency,
    minimumFractionDigits: minorDigits, maximumFractionDigits: minorDigits}).format(minor / 10 ** minorDigits);
  const componentNames: Record<string,string> = {rack: "رف مطبخ", hook: "خطّاف"};
  const price = offer.economics.price;
  if (price === null || offer.shopperShipping === null || !offer.components?.length) return null;
  const contents = offer.components.map(p => componentNames[p.id] + " × " + p.quantity.toLocaleString(locale));
  if (offer.components.some(p => !componentNames[p.id])) return null;
  const description = "تحتوي العبوة على " + contents.join("، ") + ".";
  return <section aria-label="Demo product page" dir="rtl" lang={locale} className="my-3 space-y-3 rounded-xl border p-4">
    <h4 className="text-xl font-semibold">{offer.title}</h4>
    <p>{description}</p>
    <dl><dt>سعر المنتج</dt><dd>{format(price)}</dd>
      <dt>الشحن</dt><dd>{offer.shopperShipping === 0 ? "مجاني" : format(offer.shopperShipping)}</dd>
      <dt>الإجمالي مع الشحن</dt><dd>{format(price + offer.shopperShipping)}</dd></dl>
    <details><summary>ماذا تتضمن العبوة؟</summary><ul>{contents.map(line => <li key={line}>{line}</li>)}</ul></details>
    <details><summary>معاينة نتيجة البحث</summary><strong>{offer.title} | يومياتي</strong><p>{description}</p></details>
  </section>;
}

export function OfferSelectionDemo({market}: {market: MarketCode}) {
  const [open, setOpen] = useState(false);
  const [approved, setApproved] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const {offers, reportedTotal} = demoCatalog(market);
  const report = selectOffers(market, offers, reportedTotal, demoDate);
  const {currency, minorDigits} = markets[market];
  const amount = (n: number | string | null) => n === null ? "Unknown" : (Number(n) / 10 ** minorDigits).toFixed(minorDigits) + " " + currency;
  function togglePreview() {
    if (!open) {
      try {
        const restored = report.selected.filter(({offer}) =>
          window.localStorage.getItem(demoApprovalKey(offer)) === JSON.stringify(offer));
        setApproved(restored.map(row => row.offer.sku));
        setStorageError(false);
      } catch { setStorageError(true); }
    }
    setOpen(!open);
  }
  function toggleApproval(offer: Offer, undo: boolean) {
    try {
      if (undo) window.localStorage.removeItem(demoApprovalKey(offer));
      else window.localStorage.setItem(demoApprovalKey(offer), JSON.stringify(offer));
      setStorageError(false);
    } catch { setStorageError(true); }
    setApproved(previous => undo ? previous.filter(id => id !== offer.sku) : [...previous, offer.sku]);
  }
  return <section className="space-y-3 rounded-xl border p-4">
    <button onClick={togglePreview} aria-expanded={open}>{open ? "Hide" : "Open"} product selection demo</button>
    {open && import.meta.env.DEV && typeof window !== "undefined" && ["localhost","127.0.0.1"].includes(window.location.hostname) &&
      <p>With the local offer studio running, <a className="underline" href={"http://127.0.0.1:4175/#"+market} target="_blank" rel="noreferrer">test the {markets[market].currency} shopper journey and delivery ledger</a>.</p>}
    {open && <><p>Fictional offers and market evidence. Demo approvals are saved in this browser.</p>
      {storageError && <p role="status">Browser storage is unavailable. Changes apply to this session.</p>}
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
          {selected && <button onClick={() => toggleApproval(offer, isApproved)}>{isApproved ? "Undo demo approval" : "Approve for content brief"}</button>}
          {brief && <ProductPagePreview offer={offer}/>}
          {brief && <p>Editorial brief · {brief.locale} · <span lang="ar">{brief.facts[0].statement}</span> · {brief.instructions}</p>}
        </article>;
      })}
    </>}
  </section>;
}
