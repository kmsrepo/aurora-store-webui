/**
 * Aurora Store WebUI — Play proxy server.
 *
 * Speaks Google Play's DFE protobuf API via the TypeScript port in
 * server/dfe.ts (wire-compatible with gplayapi 3.6.4) and exposes it as
 * JSON REST for the WebUI. Run alongside Vite:
 *
 *   npm run dev:server   # this server (:8080)
 *   npm run dev:full     # vite + server together
 *
 * Env: PLAY_PORT (default 8080), DISPENSER_URL (default
 * https://auroraoss.com/api/auth), EXODUS_API_KEY, DATA_DIR.
 */
import { createServer } from "node:http";
import { handle } from "./routes.ts";

const PORT = Number(process.env["PLAY_PORT"] ?? process.env["PORT"] ?? 8080);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "*";

const server = createServer(async (req, res) => {
  try {
    const origin = req.headers.origin ?? CORS_ORIGIN;
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN === "*" ? "*" : origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session, Range");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Disposition");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host ?? `127.0.0.1:${PORT}`;
    const url = new URL(req.url ?? "/", `http://${host}`);

    if (url.pathname === "/" && req.method === "GET") {
      const text = "Aurora Store WebUI Play proxy — JSON API under /api/*";
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
      res.end(text);
      return;
    }

    if (url.pathname === "/api/health" && req.method === "GET") {
      const text = JSON.stringify({ ok: true, time: new Date().toISOString() });
      res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
      res.end(text);
      return;
    }

    await handle(req, res, url);
  } catch (e) {
    if (!res.headersSent) {
      const text = JSON.stringify({ error: (e as Error).message ?? "Internal error" });
      res.writeHead(500, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
      res.end(text);
    } else {
      res.destroy();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[play-proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[play-proxy] dispenser: ${process.env["DISPENSER_URL"] ?? "https://auroraoss.com/api/auth"}`);
});

function shutdown(signal: string): void {
  console.log(`[play-proxy] ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
