export type OrderState = "pending" | "accepted" | "confirmed" | "shipped" | "delivered" | "failed" | "cancelled" | "returned" | "unknown";

// Woo payment/order states are not proof of Taager delivery.
export function normalizeWooStatus(raw: string): OrderState {
  switch (raw.trim().toLowerCase()) {
    case "pending": case "on-hold": return "pending";
    case "processing": return "accepted";
    case "cancelled": return "cancelled";
    default: return "unknown";
  }
}
