/**
 * A local-only, transport-level access gate for the OFFLINE synthetic demo.
 * This is not Supabase owner authentication and is never wired to a storefront route.
 * Both the server bind and every HTTP request are restricted to loopback.
 */
import { timingSafeEqual } from "node:crypto";

export const LOCAL_PREVIEW_FLAG = "offline-owner-test-only";

export function assertLocalPreviewSettings({ flag, hostname, secret, nodeEnv }) {
  if (
    flag !== LOCAL_PREVIEW_FLAG ||
    hostname !== "127.0.0.1" ||
    nodeEnv === "production" ||
    typeof secret !== "string" ||
    !/^[a-zA-Z0-9_-]{32,128}$/.test(secret)
  ) throw new Error("local_owner_preview_disabled");
}

export function authorizeLocalPreviewRequest(headers, method, secret) {
  if (method !== "GET" && method !== "HEAD") return false;
  if (typeof secret !== "string" || !/^[a-zA-Z0-9_-]{32,128}$/.test(secret)) return false;
  if (typeof headers?.host !== "string" || !/^127\.0\.0\.1:\d{2,5}$/.test(headers.host)) return false;
  if (typeof headers?.authorization !== "string") return false;
  const match = /^Basic ([a-zA-Z0-9+/]+={0,2})$/.exec(headers.authorization);
  if (!match || match[1].length > 512) return false;
  try {
    const received = Buffer.from(match[1], "base64");
    const expected = Buffer.from("owner:" + secret, "utf8");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
