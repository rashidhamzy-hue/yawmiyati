export const markets = {
  sa: { currency: "SAR", minorDigits: 2, locale: "ar-SA", dialingCode: "+966" },
  ae: { currency: "AED", minorDigits: 2, locale: "ar-AE", dialingCode: "+971" },
  om: { currency: "OMR", minorDigits: 3, locale: "ar-OM", dialingCode: "+968" },
  eg: { currency: "EGP", minorDigits: 2, locale: "ar-EG", dialingCode: "+20" },
  iq: { currency: "IQD", minorDigits: 3, locale: "ar-IQ", dialingCode: "+964" },
} as const;
export type MarketCode = keyof typeof markets;

export function parseMinorUnits(market: MarketCode, amount: string): number {
  const digits = markets[market].minorDigits;
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error("Invalid amount");
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > digits) throw new Error("Excess currency precision");
  const value = Number(whole + fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(value)) throw new Error("Amount exceeds safe integer range");
  return value;
}

export function calculateSubtotal(lines: readonly { unitMinor: number; quantity: number }[]): number {
  let total = 0;
  for (const { unitMinor, quantity } of lines) {
    if (!Number.isSafeInteger(unitMinor) || unitMinor < 0 || !Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error("Invalid order line");
    total += unitMinor * quantity;
    if (!Number.isSafeInteger(total)) throw new Error("Subtotal exceeds safe integer range");
  }
  return total;
}
