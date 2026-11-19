export function recordedNetMinor(entries: readonly {amountMinor:string;currency:string}[], currency:string): string {
  let total=0n;
  for (const entry of entries) {
    if (entry.currency!==currency || !/^-?\d+$/.test(entry.amountMinor)) throw new Error("Invalid financial entry");
    total+=BigInt(entry.amountMinor);
  }
  return total.toString();
}
