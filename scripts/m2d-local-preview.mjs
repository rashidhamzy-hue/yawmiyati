#!/usr/bin/env node
/**
 * Non-deployable localhost-only owner demo server. A separate Vite middleware
 * transforms ONLY the offline preview entrypoint; production app routes and
 * builds never import these files. No Supabase, supplier, AI or payment calls.
 */
import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { assertLocalPreviewSettings, authorizeLocalPreviewRequest } from "./m2d-local-access.mjs";

const hostname = "127.0.0.1";
const port = 4174;
const secret = process.env.YAWMIYATI_LOCAL_PREVIEW_SECRET;
assertLocalPreviewSettings({
  flag: process.env.YAWMIYATI_LOCAL_OWNER_PREVIEW,
  hostname,
  secret,
  nodeEnv: process.env.NODE_ENV,
});
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(repoRoot, "scripts/m2d-preview-shell.html"), "utf8");
const vite = await createViteServer({
  configFile: false,
  root: repoRoot,
  appType: "custom",
  plugins: [react(), tailwindcss()],
  server: { middlewareMode: true, hmr: false, fs: { strict: true } },
});
const server = createHttpServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!authorizeLocalPreviewRequest(req.headers, req.method, secret)) {
    res.writeHead(401, {
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="Yawmiyati offline owner review"',
    });
    res.end("Local owner preview access denied.");
    return;
  }
  try {
    if (req.url === "/__local_owner_review" || req.url === "/__local_owner_review/") {
      const page = await vite.transformIndexHtml("/__local_owner_review", html);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (req.method === "HEAD") { res.end(); return; }
      res.end(page);
      return;
    }
    vite.middlewares(req, res, () => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    });
  } catch (error) {
    vite.ssrFixStacktrace(error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Offline preview unavailable");
  }
});
server.listen(port, hostname, () => {
  console.log("Offline owner preview ready on http://127.0.0.1:" + port + "/__local_owner_review");
  console.log("Only loopback requests with local credentials are accepted.");
});
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, async () => {
  server.close();
  await vite.close();
  process.exit(0);
});
