// Market facts the brain plans with. Sources: Taager published policy pages
// (project doc Taager_shipping_policy_TEXT.md) and the competitor report.
// Values marked "assumption" are replaced by measured data once orders exist.
export type Market = "sa" | "ae" | "om" | "eg" | "iq";
export type MarketFacts = {
  code: Market;
  country: string;           // ISO 3166-1 alpha-2
  countryName: string;
  currency: string;
  minorDigits: number;       // matches src/lib/store/markets.ts
  /** Delivery fee the CUSTOMER pays per order (Taager), in minor units. Egypt varies 95-105 EGP: mid value. */
  shippingMinor: number;
  /** Share of profit ABOVE Taager's minimum that Taager deducts as VAT (Saudi only, per Taager policy). */
  vatOnAddedProfitBps: number;
  /** Charge to the merchant when a customer refuses (Egypt 5 EGP; others none published). */
  refusalChargeMinor: number;
  /** Planning delivery rate until real orders exist (assumption from the competitor report's ranges, low end). */
  defaultDeliveryRateBps: number;
  /** Approximate units of local currency per 1 USD, for thresholds and cost reporting only (assumption). */
  perUsd: number;
  dialect: string;
  retailerHints: string[];
};

export const MARKETS: Record<Market, MarketFacts> = {
  sa: { code: "sa", country: "SA", countryName: "Saudi Arabia", currency: "SAR", minorDigits: 2, shippingMinor: 2800,
    vatOnAddedProfitBps: 1500, refusalChargeMinor: 0, defaultDeliveryRateBps: 7500, perUsd: 3.75, dialect: "Saudi (Najdi/Hijazi-neutral, light Gulf)",
    retailerHints: ["amazon.sa", "noon.com/saudi-en", "jarir.com", "extra.com", "centrepointstores.com/sa", "namshi.com", "homecentre.com/sa", "ikea.com/sa", "alsaifgallery.com", "nahdionline.com"] },
  ae: { code: "ae", country: "AE", countryName: "United Arab Emirates", currency: "AED", minorDigits: 2, shippingMinor: 1900,
    vatOnAddedProfitBps: 0, refusalChargeMinor: 0, defaultDeliveryRateBps: 7500, perUsd: 3.6725, dialect: "Emirati/Gulf",
    retailerHints: ["amazon.ae", "noon.com/uae-en", "carrefouruae.com", "sharafdg.com", "namshi.com", "homecentre.com/ae", "ikea.com/ae"] },
  om: { code: "om", country: "OM", countryName: "Oman", currency: "OMR", minorDigits: 3, shippingMinor: 3000,
    vatOnAddedProfitBps: 0, refusalChargeMinor: 0, defaultDeliveryRateBps: 7000, perUsd: 0.3845, dialect: "Omani/Gulf",
    retailerHints: ["amazon.ae", "noon.com", "lulu", "carrefour oman", "talabat mart oman"] },
  eg: { code: "eg", country: "EG", countryName: "Egypt", currency: "EGP", minorDigits: 2, shippingMinor: 10000,
    vatOnAddedProfitBps: 0, refusalChargeMinor: 500, defaultDeliveryRateBps: 6500, perUsd: 48, dialect: "Egyptian (Cairene)",
    retailerHints: ["amazon.eg", "noon.com/egypt-en", "jumia.com.eg", "btech.com", "2b.com.eg", "carrefouregypt.com"] },
  iq: { code: "iq", country: "IQ", countryName: "Iraq", currency: "IQD", minorDigits: 3, shippingMinor: 7000000,
    vatOnAddedProfitBps: 0, refusalChargeMinor: 0, defaultDeliveryRateBps: 7000, perUsd: 1310, dialect: "Iraqi (Baghdadi)",
    retailerHints: ["miswag.com", "elryan.com", "amazon (shipped to Iraq)", "noon (shipped to Iraq)"] },
};

export function isMarket(value: unknown): value is Market {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MARKETS, value);
}

/** "89.5" / "89,50" / "1,234.00" -> minor units (round half up beyond the market's precision). null if not a price. */
export function decimalToMinor(value: unknown, digits: number): number | null {
  if (typeof value === "number") value = String(value);
  if (typeof value !== "string") return null;
  let s = value.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,3}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(digits + 1)).slice(0, digits + 1);
  let minor = Number(whole) * 10 ** digits + Number(padded.slice(0, digits) || "0");
  if (Number(padded[digits] ?? "0") >= 5) minor += 1;
  return Number.isSafeInteger(minor) ? minor : null;
}

export function minorToDecimal(minor: number, digits: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** digits);
  const frac = String(abs % 10 ** digits).padStart(digits, "0").replace(/0+$/, "");
  return sign + whole + (frac ? "." + frac : "");
}

export function minorToUsd(minor: number, m: MarketFacts): number {
  return minor / 10 ** m.minorDigits / m.perUsd;
}
export function usdToMinor(usd: number, m: MarketFacts): number {
  return Math.round(usd * m.perUsd * 10 ** m.minorDigits);
}
