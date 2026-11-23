import { useState } from "react";
import { Check, ImageOff, ShoppingBag, Truck } from "lucide-react";
import { paymentLabel } from "../../../supabase/functions/_shared/payment-policy";
import type { MarketCode } from "@/lib/store/markets";
import { doorMinor, exactUnitPrice, formatMinor, marketZones, type ApprovedOfferVersion, type PublicPack } from "@/lib/store/offer-version";
import { addOfferLine, setOfferZone, useOfferCart } from "@/lib/store/offer-cart";

export function FixtureNotice() {
  return <p role="note" data-offer-fixture-notice className="rounded-xl border border-dashed border-primary/40 bg-primary-soft px-4 py-2 text-xs font-bold leading-6 text-primary">
    بيئة اختبار محلية: المنتجات والأسعار ورسوم التوصيل هنا تجريبية، ولا يُرسل أي طلب.
  </p>;
}

const money = (market: MarketCode, minor: bigint | string) => BigInt(minor) > 0n ? formatMinor(market, minor) : "مشمول";

/** Product detail for an approved offer version: pack, eligible add-on, zone and exact door total. */
export function OfferProductPanel({ market, version, versions }: { market: MarketCode; version: ApprovedOfferVersion; versions: readonly ApprovedOfferVersion[] }) {
  const cart = useOfferCart(market);
  const zones = marketZones(versions).filter(z => version.zones.some(v => v.zone_id === z.zone_id));
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const zoneId = chosenZone ?? (zones.some(z => z.zone_id === cart.zone_id) ? cart.zone_id : zones.length === 1 ? zones[0]?.zone_id ?? null : null);
  const zone = version.zones.find(z => z.zone_id === zoneId) ?? null;
  const selectable = version.packs.filter(p => p.selectable);
  const available = (p: PublicPack) => !zone || zone.pack_ids.includes(p.pack_id);
  const [packChoice, setPackChoice] = useState(version.default_pack_id);
  const pack = available(selectable.find(p => p.pack_id === packChoice)!) ? selectable.find(p => p.pack_id === packChoice)! : selectable.find(available) ?? null;
  const addOn = pack && zone ? version.add_ons.find(a => a.from_pack_id === pack.pack_id && a.zone_ids.includes(zone.zone_id)) ?? null : null;
  const [withAddOn, setWithAddOn] = useState(false);
  const effective = addOn && withAddOn ? version.packs.find(p => p.pack_id === addOn.to_pack_id)! : pack;
  const [status, setStatus] = useState<"" | "added" | "already">("");
  const pickZone = (id: string) => { setChosenZone(id); setOfferZone(market, id); setStatus(""); };
  const add = () => {
    if (!effective || !zone) return;
    setStatus(addOfferLine(market, { listing_id: version.listing_id, slug: version.slug, version_id: version.version_id, revision: version.revision,
      pack_id: effective.pack_id, add_on_id: addOn && withAddOn ? addOn.add_on_id : null }, zone.zone_id));
  };
  return <article dir="rtl" className="grid gap-6 lg:grid-cols-2" aria-label="تفاصيل المنتج" data-offer-version={version.version_id}>
    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-[#efe6d7]">
      {version.image ? <img src={version.image.url} alt={version.image.alt} className="h-full w-full object-contain" /> :
        <div className="flex flex-col items-center gap-3 text-muted-foreground"><ImageOff className="h-12 w-12" aria-hidden="true" /><span>لا تتوفر صورة معتمدة</span></div>}
    </div>
    <div className="space-y-5">
      <FixtureNotice />
      <h1 className="font-display text-2xl font-extrabold leading-relaxed sm:text-3xl">{version.title}</h1>
      {version.description.trim() && <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{version.description}</p>}

      {zones.length > 1 && <fieldset className="space-y-2">
        <legend className="text-sm font-extrabold">منطقة التوصيل</legend>
        <div className="grid gap-2 sm:grid-cols-3">{zones.map(z => {
          const vz = version.zones.find(v => v.zone_id === z.zone_id)!;
          return <label key={z.zone_id} className={"flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm " + (zoneId === z.zone_id ? "border-primary bg-primary-soft font-bold" : "")}>
            <span className="flex items-center gap-2"><input type="radio" name="offer-zone" value={z.zone_id} checked={zoneId === z.zone_id} onChange={() => pickZone(z.zone_id)} className="accent-[var(--primary)]" />{z.label}</span>
            <span className="text-xs text-muted-foreground">{money(market, vz.delivery_minor)}</span>
          </label>;
        })}</div>
        {!zone && <p className="text-xs text-muted-foreground">اختاري منطقة التوصيل لعرض الإجمالي عند الاستلام.</p>}
      </fieldset>}

      <fieldset className="space-y-2">
        <legend className="text-sm font-extrabold">اختاري العبوة</legend>
        <div className="grid gap-2">{selectable.map(p => {
          const unit = exactUnitPrice(p), on = pack?.pack_id === p.pack_id, ok = available(p);
          return <label key={p.pack_id} className={"flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 " + (ok ? "cursor-pointer " : "opacity-50 ") + (on ? "border-primary bg-primary-soft" : "")}>
            <span className="flex items-center gap-3">
              <input type="radio" name="offer-pack" value={p.pack_id} checked={on} disabled={!ok} onChange={() => { setPackChoice(p.pack_id); setWithAddOn(false); setStatus(""); }} className="accent-[var(--primary)]" />
              <span><span className="block font-bold">{p.label}</span>
                {unit !== null && <span className="block text-xs text-muted-foreground">{formatMinor(market, unit)} للقطعة</span>}
                {!ok && <span className="block text-xs text-muted-foreground">غير متاحة لهذه المنطقة</span>}</span>
            </span>
            <span className="font-extrabold text-primary">{formatMinor(market, p.price_minor)}</span>
          </label>;
        })}</div>
      </fieldset>

      {addOn && <label className={"flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 " + (withAddOn ? "border-primary bg-primary-soft" : "")} data-offer-add-on={addOn.add_on_id}>
        <span className="flex items-center gap-3"><input type="checkbox" checked={withAddOn} onChange={e => { setWithAddOn(e.target.checked); setStatus(""); }} className="h-5 w-5 accent-[var(--primary)]" />
          <span><span className="block font-bold">{addOn.label}</span><span className="block text-xs text-muted-foreground">تصبح العبوة: {version.packs.find(p => p.pack_id === addOn.to_pack_id)!.label}</span></span></span>
        <span className="font-extrabold text-primary">+ {formatMinor(market, BigInt(version.packs.find(p => p.pack_id === addOn.to_pack_id)!.price_minor) - BigInt(pack!.price_minor))}</span>
      </label>}

      <section aria-label="الإجمالي عند الاستلام" className="rounded-2xl border bg-card p-4">
        {effective && zone ? <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>سعر {effective.label}</dt><dd className="font-bold">{formatMinor(market, effective.price_minor)}</dd></div>
          <div className="flex justify-between"><dt className="flex items-center gap-1"><Truck className="h-4 w-4" aria-hidden="true" />التوصيل · {zone.label}</dt><dd className="font-bold">{effective.shipping === "zone_rate" ? money(market, zone.delivery_minor) : "مشمول"}</dd></div>
          <div className="flex justify-between border-t pt-3 text-base"><dt className="font-extrabold">الإجمالي عند الاستلام</dt><dd className="font-extrabold text-primary" data-door-total>{formatMinor(market, doorMinor(effective, zone))}</dd></div>
          <p className="text-xs text-muted-foreground">{paymentLabel}</p>
        </dl> : <p className="text-sm text-muted-foreground">{pack ? "اختاري منطقة التوصيل لعرض الإجمالي." : "لا تتوفر عبوة لهذه المنطقة."}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} disabled={!effective || !zone} className="btn-primary inline-flex min-h-12 items-center gap-2 disabled:opacity-50"><ShoppingBag className="h-5 w-5" aria-hidden="true" />أضيفي إلى السلة</button>
        {status && <p role="status" className="inline-flex items-center gap-2 text-sm font-bold text-primary"><Check className="h-4 w-4" aria-hidden="true" />{status === "added" ? "أُضيف إلى السلة" : "موجود في السلة"} · <a href={"/" + market + "/cart"} className="underline underline-offset-4">عرض السلة</a></p>}
      </div>
    </div>
  </article>;
}
