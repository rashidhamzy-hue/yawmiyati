import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export function verifyWooWebhook(body: Uint8Array, signature: string, secret: string) {
  if (!secret || body.byteLength > 1024 * 1024 || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const supplied = Buffer.from(signature, "base64");
  const expected = createHmac("sha256", secret).update(body).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export function webhookDigest(body: Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}
