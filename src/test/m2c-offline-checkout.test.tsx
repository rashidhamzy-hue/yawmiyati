import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { markets, type MarketCode } from "../lib/store/markets";
import { addressSamples } from "../lib/store/simulation/addresses";
import { createOfflineCheckoutSession } from "../lib/store/simulation/checkout-session";
import { SIMULATION_MODE } from "../lib/store/simulation/fixtures";
import { OfflineCodCheckoutDemo } from "../lib/store/simulation/OfflineCodCheckoutDemo";

const all = ["sa","ae","om","eg","iq"] as const;

function firstAvailable(session: ReturnType<typeof createOfflineCheckoutSession>) {
  const product = session.catalog().find(p =>
    p.variants.some(v => v.stock === "available" && v.availableUnits > 0)
  )!;
  const variant = product.variants.find(v => v.stock === "available" && v.availableUnits > 0)!;
  return { sku:product.sku, variantSku:variant.sku, quantity:1 };
}
function readySession(market:MarketCode) {
  const session = createOfflineCheckoutSession(market);
  session.updateLine({mode:SIMULATION_MODE,...firstAvailable(session)});
  session.setAddress({mode:SIMULATION_MODE,address:addressSamples[market]});
  session.review({mode:SIMULATION_MODE});
  return session;
}

describe("Milestone 2C: offline checkout state and policy",()=>{
  it("reuses the original sandbox quote in five exact market currencies",()=>{
    for(const market of all) {
      const session=readySession(market);
      const view=session.snapshot();
      expect(view.synthetic).toBe(true);
      expect(view.mode).toBe(SIMULATION_MODE);
      expect(view.market).toBe(market);
      expect(view.quote?.currency).toBe(markets[market].currency);
      expect(view.quote?.totalMinor).toBe((view.quote?.subtotalMinor??0)+(view.quote?.shippingMinor??0));
      expect(view.quote?.maySubmitToSupplier).toBe(false);
      expect(view.address?.synthetic).toBe(true);
      expect(view.reviewed).toBe(true);
      const receipt=session.place({mode:SIMULATION_MODE,clientRequestId:"offline-"+market,acknowledgeSimulation:true});
      expect(receipt.id).toMatch(/^SIM-/);
      expect(receipt.market).toBe(market);
      expect(receipt.currency).toBe(markets[market].currency);
      expect(receipt.status).toBe("pending");
      expect(receipt.supplierAcknowledged).toBe(false);
      expect(receipt.paymentCollected).toBe(false);
      expect(receipt.totalMinor).toBe(view.quote?.totalMinor);
    }
  });
  it("fails closed across market boundaries and invalid inventory",()=>{
    const session=createOfflineCheckoutSession("sa");
    const foreign=firstAvailable(createOfflineCheckoutSession("eg"));
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...foreign})).toThrow("unknown_or_cross_market_sku");
    const valid=firstAvailable(session);
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...valid,variantSku:"SIM-SA-999-X"})).toThrow("unknown_variant");
    const blocked=session.catalog().flatMap(p=>p.variants.map(v=>({p,v}))).find(x=>x.v.stock!=="available")!;
    expect(()=>session.updateLine({mode:SIMULATION_MODE,sku:blocked.p.sku,variantSku:blocked.v.sku,quantity:1})).toThrow("stock_not_verified_in_fixture");
    expect(session.snapshot().lines).toHaveLength(0);
    expect(()=>session.setAddress({mode:SIMULATION_MODE,address:addressSamples.eg})).toThrow("unsafe_or_cross_market_address");
    expect(session.snapshot().address).toBeNull();
  });
  it("validates simulation capability on every mutation, including no-PII address",()=>{
    const session=createOfflineCheckoutSession("ae");
    const line=firstAvailable(session);
    const live="LIVE" as typeof SIMULATION_MODE;
    expect(()=>session.updateLine({mode:live,...line})).toThrow("simulation_mode_required");
    expect(()=>session.setAddress({mode:live,address:addressSamples.ae})).toThrow("simulation_mode_required");
    expect(()=>session.review({mode:live})).toThrow("simulation_mode_required");
    expect(()=>session.place({mode:live,clientRequestId:"fake123",acknowledgeSimulation:true})).toThrow("simulation_mode_required");
    expect(session.snapshot().lines).toHaveLength(0);
    expect(session.snapshot().receipt).toBeNull();
  });
  it("requires a real offline review and explicit acknowledgement before SIM receipt",()=>{
    const session=createOfflineCheckoutSession("om");
    expect(()=>session.review({mode:SIMULATION_MODE})).toThrow("synthetic_address_required");
    expect(()=>session.place({mode:SIMULATION_MODE,clientRequestId:"offline-om",acknowledgeSimulation:true})).toThrow("review_required");
    session.setAddress({mode:SIMULATION_MODE,address:addressSamples.om});
    expect(()=>session.review({mode:SIMULATION_MODE})).toThrow("empty_cart");
    session.updateLine({mode:SIMULATION_MODE,...firstAvailable(session)});
    session.review({mode:SIMULATION_MODE});
    expect(()=>session.place({mode:SIMULATION_MODE,clientRequestId:"offline-om",acknowledgeSimulation:false})).toThrow("simulation_acknowledgement_required");
    expect(session.snapshot().receipt).toBeNull();
  });
  it("supports quantity change/removal, revalidates stock atomically, and invalidates review",()=>{
    const session=createOfflineCheckoutSession("iq");
    const line=firstAvailable(session);
    session.updateLine({mode:SIMULATION_MODE,...line});
    session.setAddress({mode:SIMULATION_MODE,address:addressSamples.iq});
    session.review({mode:SIMULATION_MODE});
    const original=session.snapshot().quote?.totalMinor;
    session.updateLine({mode:SIMULATION_MODE,...line,quantity:2});
    expect(session.snapshot().reviewed).toBe(false);
    expect(session.snapshot().quote?.totalMinor).toBeGreaterThan(original!);
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...line,quantity:21})).toThrow("invalid_quantity");
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...line,quantity:9})).toThrow("stock_not_verified_in_fixture");
    expect(session.snapshot().lines[0].quantity).toBe(2);
    session.updateLine({mode:SIMULATION_MODE,...line,quantity:0});
    expect(session.snapshot().lines).toHaveLength(0);
    expect(session.snapshot().quote).toBeNull();
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...line,quantity:0})).toThrow("unknown_cart_line");
  });
  it("canonicalizes every address input; never saves user-supplied PII",()=>{
    const session=createOfflineCheckoutSession("sa");
    session.setAddress({mode:SIMULATION_MODE,address:{
      ...addressSamples.sa,
      city:"Actual User City",
      label:"Actual User Name",
      phone:"999-SECRET-PII",
      email:"actual@example.org",
    }});
    const serialized=JSON.stringify(session.snapshot());
    expect(serialized).not.toContain("Actual User");
    expect(serialized).not.toContain("999-SECRET");
    expect(serialized).not.toContain("example.org");
    expect(session.snapshot().address).toEqual(addressSamples.sa);
  });
  it("makes detached snapshots, locks the receipt, replays only the same key",()=>{
    const session=readySession("eg");
    const view=session.snapshot();
    (view.lines as Array<{quantity:number}>)[0].quantity=99;
    (view.address as {city:string}).city="spoof";
    expect(session.snapshot().lines[0].quantity).toBe(1);
    expect(session.snapshot().address?.city).toBe(addressSamples.eg.city);
    const input={mode:SIMULATION_MODE,clientRequestId:"offline-eg-123",acknowledgeSimulation:true};
    const first=session.place(input);
    const replay=session.place(input);
    expect(first.id).toBe(replay.id);
    expect(replay.events).toHaveLength(1);
    expect(()=>session.place({...input,clientRequestId:"offline-eg-456"})).toThrow("simulation_already_placed");
    expect(()=>session.updateLine({mode:SIMULATION_MODE,...firstAvailable(session),quantity:2})).toThrow("simulation_locked_after_place");
    expect(()=>session.setAddress({mode:SIMULATION_MODE,address:addressSamples.eg})).toThrow("simulation_locked_after_place");
    expect(()=>session.review({mode:SIMULATION_MODE})).toThrow("simulation_locked_after_place");
  });
  it("never calls fetch in the complete five-market checkout flow",()=>{
    const network=vi.spyOn(globalThis,"fetch");
    try {
      for(const market of all)readySession(market).place({
        mode:SIMULATION_MODE,clientRequestId:"offline-"+market,acknowledgeSimulation:true,
      });
      expect(network).not.toHaveBeenCalled();
    }finally{network.mockRestore();}
  });
});

describe("Milestone 2C isolated Arabic demo",()=>{
  it("renders conspicuous offline safety warnings, and no personal input or real payment",()=>{
    const {container}=render(<OfflineCodCheckoutDemo/>);
    expect(screen.getByText("DEMO · SIMULATION ONLY")).toBeTruthy();
    expect(container.querySelector('[data-simulation-only="true"]')).toBeTruthy();
    expect(container.querySelectorAll('input[type="tel"],input[type="email"],input[type="text"],textarea')).toHaveLength(0);
    expect(screen.queryByRole("button",{name:/ادفع الآن|إتمام الشراء|شراء الآن/})).toBeNull();
    expect(screen.getByText(/قيمة مصر الموضوعة للاختبارات الحسابية فقط/)).toBeTruthy();
  });
  it("navigates cart, country-specific sample address, review and receipt with acknowledgement",()=>{
    render(<OfflineCodCheckoutDemo initialMarket="sa"/>);
    expect(screen.getByRole("button",{name:"التالي: عنوان اصطناعي"}).hasAttribute("disabled")).toBe(true);
    const add=screen.getAllByRole("button",{name:/إضافة تجريبية:/}).find(x=>!x.hasAttribute("disabled"))!;
    fireEvent.click(add);
    expect(screen.getByRole("button",{name:"التالي: عنوان اصطناعي"}).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button",{name:"التالي: عنوان اصطناعي"}));
    expect(screen.getByText("اختيار عنوان تجريبي جاهز")).toBeTruthy();
    expect(screen.getByRole("button",{name:"مراجعة الطلب التجريبي"}).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"استخدام العنوان الاصطناعي"}));
    fireEvent.click(screen.getByRole("button",{name:"مراجعة الطلب التجريبي"}));
    expect(screen.getByRole("button",{name:"إنشاء إيصال محاكاة فقط"}).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button",{name:"إنشاء إيصال محاكاة فقط"}));
    expect(screen.getByTestId("simulation-order-id").textContent).toMatch(/^SIM-SA-ORDER-/);
    expect(screen.getByText(/لم يتم جمع أي دفعة/)).toBeTruthy();
  });
  it("changing country discards any prior cart and uses that market currency",()=>{
    render(<OfflineCodCheckoutDemo/>);
    const add=screen.getAllByRole("button",{name:/إضافة تجريبية:/}).find(x=>!x.hasAttribute("disabled"))!;
    fireEvent.click(add);
    expect(screen.getByRole("button",{name:"التالي: عنوان اصطناعي"}).hasAttribute("disabled")).toBe(false);
    fireEvent.change(screen.getByRole("combobox",{name:"دولة اختبار الدفع"}),{target:{value:"om"}});
    expect(screen.getByRole("button",{name:"التالي: عنوان اصطناعي"}).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/السلة فارغة/)).toBeTruthy();
    expect(screen.getByRole("combobox",{name:"دولة اختبار الدفع"})).toHaveProperty("value","om");
  });
});
