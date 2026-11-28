/**
 * Writes the storefront stylesheet into every HTML page, just before </head>, so the first paint needs one request
 * instead of two (the 20 KB stylesheet used to block rendering for 0.5–0.8 s on a phone connection).
 * The root route links no stylesheet in production, so React finds the same head on the server and in the browser.
 * Works on the response stream: nothing is buffered beyond a few characters.
 */
export const INLINE_STYLE_MARK = "data-ym-css";
export function inlineStylesheet(response: Response, css: string): Response {
  const type = response.headers.get("content-type") ?? "";
  if (!css || !response.body || !type.includes("text/html")) return response;
  const tag = `<style ${INLINE_STYLE_MARK}="">${css.replace(/<\/style/gi, "<\\/style")}</style>`;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  let done = false, tail = "";
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (done) { controller.enqueue(chunk); return; }
      const text = tail + decoder.decode(chunk, { stream: true });
      const at = text.indexOf("</head>");
      if (at >= 0) { done = true; tail = ""; controller.enqueue(encoder.encode(text.slice(0, at) + tag + text.slice(at))); return; }
      // "</head>" may be split across two chunks: hold back its length minus one.
      const keep = Math.min(6, text.length);
      if (text.length > keep) controller.enqueue(encoder.encode(text.slice(0, text.length - keep)));
      tail = text.slice(text.length - keep);
    },
    flush(controller) { const rest = tail + decoder.decode(); if (rest) controller.enqueue(encoder.encode(rest)); },
  }));
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
