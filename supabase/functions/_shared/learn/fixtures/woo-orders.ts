// FIXTURE ONLY. WooCommerce REST (wc/v3) order payloads shaped like the public API documentation, with invented
// customers. Used by tests and by the daily loop ONLY when the local fixture flag is on (never in a deployed function).
// The custom statuses ("wc-confirmed", "wc-refused", ...) are our best guess of what the supplier's plugin writes:
// G1's real test orders replace them.
const base = (id: number, status: string, hours: number, over: Record<string, unknown> = {}) => ({
  id, number: String(1000 + id), status, currency: "SAR", total: "177.00", shipping_total: "28.00",
  date_created_gmt: "2026-11-27T08:00:00", date_modified_gmt: new Date(Date.parse("2026-11-27T08:00:00Z") + hours * 3_600_000).toISOString().slice(0, 19),
  billing: { first_name: "Fixture", last_name: "Customer", phone: "0501234567", address_1: "Fixture street", email: "fixture@example.invalid" },
  customer_note: "", line_items: [{ sku: "FIX-SKU-1", quantity: 1, total: "149.00", name: "Fixture product" }],
  meta_data: [{ key: "ym_last_source", value: "facebook" }, { key: "ym_last_medium", value: "paid" }, { key: "ym_last_campaign", value: "fixture" }], ...over,
});
export const FIXTURE_WOO_ORDERS = [
  base(1, "processing", 0),
  base(2, "wc-confirmed", 3, { billing: { phone: "+966 50 765 4321" } }),
  base(3, "completed", 40, { billing: { phone: "٠٥٠١١١٢٢٣٣" }, line_items: [{ sku: "FIX-SKU-1", quantity: 2, total: "268.00" }], total: "296.00" }),
  base(4, "wc-refused", 50, { customer_note: "السعر غالي", billing: { phone: "0509998877" } }),
  base(5, "cancelled", 26, { meta_data: [{ key: "taager_status_reason", value: "Customer not answering" }], billing: { phone: "0509998877" } }),
  base(6, "wc-returned", 90, { billing: { phone: "0509998877" } }),
  base(7, "wc-mystery-state", 5),
  { ...base(8, "processing", 1), currency: "AED" },
];
