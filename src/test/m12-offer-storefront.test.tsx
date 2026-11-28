import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fixtureOfferVersions } from "@/fixtures/storefront-offers";
import { OfferProductPanel } from "@/components/preview/OfferProductPanel";
import { OfferCartPage } from "@/components/preview/OfferCartPage";
import { offerCartKey, readOfferCart } from "@/lib/store/offer-cart";
import { fixtureHostAllowed, offerFixturesRequested } from "@/lib/store/offer-source";

afterEach(() => { cleanup(); localStorage.clear(); });
const sa = fixtureOfferVersions("sa").versions;
const eg = fixtureOfferVersions("eg").versions;
const rack = sa.find(v => v.slug === "spice-rack")!;
const brush = eg.find(v => v.slug === "hair-brush")!;
const total = () => document.querySelector("[data-door-total]")?.textContent ?? "";

describe("M12 storefront offer wiring", () => {
  it("fixture mode is off unless explicitly requested and loopback-only", () => {
    expect(offerFixturesRequested).toBe(false);
    for (const h of ["127.0.0.1", "localhost", "shop.test"]) expect(fixtureHostAllowed(h)).toBe(true);
    for (const h of ["yawmiyati.com", "example.pages.dev", "skhtunkknshvolturqlm.supabase.co"]) expect(fixtureHostAllowed(h)).toBe(false);
  });

  it("selects a pack, applies an eligible add-on and shows the door total", () => {
    render(<OfferProductPanel market="sa" version={rack} versions={sa} />);
    expect(screen.getByRole("note").textContent).toContain("تجريبية");
    const before = total();
    fireEvent.click(screen.getByRole("radio", { name: /حامل واحد/ }));
    expect(total()).not.toBe(before);
    const single = total();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(total()).not.toBe(single);
    fireEvent.click(screen.getByRole("button", { name: "أضيفي إلى السلة" }));
    expect(screen.getByRole("status").textContent).toContain("أُضيف إلى السلة");
    const cart = readOfferCart("sa");
    expect(cart.lines).toEqual([{ listing_id: rack.listing_id, slug: "spice-rack", version_id: rack.version_id, revision: 1, pack_id: "rack-hook-kit", add_on_id: "hook" }]);
    expect(localStorage.getItem(offerCartKey("ae"))).toBeNull();
  });

  it("requires an Egyptian delivery zone and withdraws the clip add-on where ineligible", () => {
    render(<OfferProductPanel market="eg" version={brush} versions={eg} />);
    expect(screen.getByRole("button", { name: "أضيفي إلى السلة" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: /منطقة التوصيل الأولى/ }));
    expect(screen.queryByRole("checkbox")).not.toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /منطقة التوصيل الثالثة/ }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(readOfferCart("eg").zone_id).toBe("z3");
  });

  it("checkout review shows the door total and cannot submit an order", () => {
    localStorage.setItem(offerCartKey("sa"), JSON.stringify({ market: "sa", zone_id: "z1", lines: [{ listing_id: rack.listing_id, slug: "spice-rack", version_id: rack.version_id, revision: 1, pack_id: "single", add_on_id: null }] }));
    render(<OfferCartPage market="sa" type="checkout" versions={sa} />);
    expect(document.querySelector("[data-cart-door-total]")?.textContent).toMatch(/٨٥/);
    expect(screen.getByRole("button", { name: "تأكيد الطلب" })).toHaveProperty("disabled", true);
    const form=document.querySelector("form")!;
    expect(form.getAttribute("action")).toBeNull();
    expect(form.hasAttribute("data-private")).toBe(true);
    expect(document.querySelector("input[type=tel]")).not.toBeNull();
  });
});
