import "./lib/error-capture";

import * as Sentry from "@sentry/cloudflare";
import { consumeLastCapturedError } from "./lib/error-capture";
import { SENTRY_DSN, IGNORE_ERRORS, scrubEvent, sentryEnvironment } from "./lib/monitoring/sentry-config";
import { renderErrorPage } from "./lib/error-page";
import { posthogProxyTarget, proxyPosthog } from "./lib/analytics/posthog-proxy";
import { handleSeoRequest, robotsHeaderFor } from "./lib/seo/endpoints";
import { handleMetaEvents, type CapiEnv } from "./lib/analytics/meta-capi.server";
import { handleEditorialMedia } from "./lib/store/editorial-media";
import { handleProductMedia } from "./lib/store/product-media";
import { handleVisitorCountry, rootRedirect } from "./lib/store/visitor-country";
import { mediaBucket, type MediaContext } from "./lib/store/media-store";
import { inlineStylesheet } from "./lib/inline-css";
// The built stylesheet as text, for the server only (it never reaches the browser bundle).
import storefrontCss from "./styles.css?inline";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const swallowed = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(swallowed);
  Sentry.captureException(swallowed, { tags: { boundary: "ssr_h3" } });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Staging and preview hosts must never be indexed, even after launch.
function withRobotsHeader(response: Response, value: string | null): Response {
  if (!value) return response;
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Cloudflare's edge cache in front of the media routes: pictures are immutable, so a cached copy is served without
 * touching R2 or the source. Keyed by URL plus the negotiated format; range requests (video) are never cached here.
 */
async function edgeCached(request: Request, ctx: MediaContext, load: () => Promise<Response>): Promise<Response> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || request.method !== "GET" || request.headers.has("range")) return load();
  const accept = request.headers.get("accept") ?? "";
  const format = accept.includes("image/avif") ? "avif" : accept.includes("image/webp") ? "webp" : "base";
  const url = new URL(request.url);
  url.searchParams.set("__f", format);
  const key = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return hit;
  const response = await load();
  if (response.status === 200 && response.body) {
    const copy = response.clone();
    const save = cache.put(key, copy).catch(() => undefined);
    if (ctx?.waitUntil) ctx.waitUntil(save);
  }
  return response;
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
const handler = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const proxyTarget = posthogProxyTarget(new URL(request.url));
    if (proxyTarget) {
      try { return await proxyPosthog(request, proxyTarget); }
      catch { return new Response(null, { status: 502 }); }
    }
    if (new URL(request.url).pathname.startsWith("/media/")) {
      // Our own copies live in R2 (binding MEDIA); the edge cache sits in front so repeat views cost nothing.
      const store = { bucket: mediaBucket(env), ctx: ctx as MediaContext };
      const product = /^\/media\/[pv]\//.test(new URL(request.url).pathname);
      try {
        return await edgeCached(request, ctx as MediaContext, async () =>
          (product ? await handleProductMedia(request, fetch, store) : await handleEditorialMedia(request, fetch, store))!);
      } catch { return new Response(null, { status: 502 }); }
    }
    const robotsHeader = robotsHeaderFor(new URL(request.url).hostname);
    // Country handling from Cloudflare's header only (nothing stored): the root sends visitors from our five
    // countries to their store; store pages are never redirected.
    const geo = handleVisitorCountry(request) ?? rootRedirect(request);
    if (geo) return withRobotsHeader(geo, robotsHeader);
    try {
      // Server half of the Meta events (same event id as the browser Pixel). Sends nothing without its two secrets.
      const meta = await handleMetaEvents(request, env as CapiEnv);
      if (meta) return meta;
      const seo = await handleSeoRequest(request);
      if (seo) return withRobotsHeader(seo, robotsHeader);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withRobotsHeader(inlineStylesheet(await normalizeCatastrophicSsrResponse(response), import.meta.env.DEV ? "" : storefrontCss), robotsHeader);
    } catch (error) {
      console.error(error);
      Sentry.captureException(error, { tags: { boundary: "worker_fetch" } });
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

// Server-side error tracking (errors only, no tracing, no PII). Local runs never report.
export default Sentry.withSentry(
  () => ({
    dsn: SENTRY_DSN,
    dataCollection:{ userInfo:false,cookies:false,httpHeaders:{allow:["user-agent","accept-language","cf-ipcountry"]},httpBodies:[],urlQueryParams:false},
    tracesSampleRate: 0,
    ignoreErrors: IGNORE_ERRORS,
    beforeSend(event) {
      let host = "";
      try { host = new URL(event.request?.url ?? "").hostname; } catch { /* no request */ }
      const environment = host ? sentryEnvironment(host) : "staging";
      if (environment === "local") return null;
      event.environment = environment;
      return scrubEvent(event);
    },
  }),
  handler as unknown as Parameters<typeof Sentry.withSentry>[1],
);
