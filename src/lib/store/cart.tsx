import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getProduct } from "./catalog";

export type CartLine = { slug: string; variant?: string | undefined; qty: number };
type Ctx = {
  lines: CartLine[]; count: number; subtotal: number;
  add: (slug: string, variant?: string, qty?: number) => void;
  setQty: (i: number, qty: number) => void; remove: (i: number) => void; clear: () => void;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = "yawmiyati-sa-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(lines)); }, [lines, ready]);

  const add: Ctx["add"] = (slug, variant, qty = 1) =>
    setLines((ls) => {
      const i = ls.findIndex((l) => l.slug === slug && l.variant === variant);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { slug, variant, qty }];
    });
  const setQty = (i: number, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((_, j) => j !== i) : ls.map((l, j) => (j === i ? { ...l, qty } : l))));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  const clear = () => setLines([]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + (getProduct(l.slug)?.price ?? 0) * l.qty, 0);
  return <CartCtx.Provider value={{ lines, count, subtotal, add, setQty, remove, clear }}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
